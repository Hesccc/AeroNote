import time
import json
import logging
import threading
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from croniter import croniter
from apps.exts import db
from apps.models.model import Posts, Categories, Tags, PostCategories, PostTags, Config
from apps.tools.llm import llm_chat_completion
from apps.tools.logger import scheduler_logger

logger = scheduler_logger

# ── 内存滚动日志与调度器状态控制 ──
_LOG_QUEUE = deque(maxlen=200)
_SCHEDULER_LOCK = threading.Lock()
_SCHEDULER_THREAD = None
_GLOBAL_APP = None
_LAST_RUN_TIME = None
_NEXT_RUN_TIME = None
_PROCESSED_COUNT = 0
_DEFAULT_CRON = "*/5 * * * *"  # 默认每 5 分钟
_DEFAULT_THREADS = 3           # 默认并发 3 线程

# ── 工业级防积压锁与在途保护 ──
_IS_BATCH_RUNNING = False
_IN_FLIGHT_POST_IDS = set()


def add_scheduler_log(level: str, message: str):
    """记录一条定时任务执行日志（带精确时间戳，保留最近 200 条）"""
    log_entry = {
        'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'level': level,  # INFO, SUCCESS, WARN, ERROR
        'message': message
    }
    with _SCHEDULER_LOCK:
        _LOG_QUEUE.appendleft(log_entry)
    if level == 'ERROR':
        logger.error(f"[AI Scheduler] {message}")
    elif level == 'WARN':
        logger.warning(f"[AI Scheduler] {message}")
    else:
        logger.info(f"[AI Scheduler] {message}")


def get_scheduler_logs():
    """获取所有内存任务日志"""
    with _SCHEDULER_LOCK:
        return list(_LOG_QUEUE)


def is_scheduler_enabled():
    """从数据库 config 表获取开关状态，默认开启 ('true')"""
    conf = Config.query.filter_by(name='ai_scheduler_enabled').first()
    if conf:
        return conf.value.lower() in ('true', '1', 'yes')
    return True


def set_scheduler_enabled(enabled: bool):
    """修改定时任务开关状态并写入数据库"""
    val = 'true' if enabled else 'false'
    conf = Config.query.filter_by(name='ai_scheduler_enabled').first()
    if conf:
        conf.value = val
    else:
        conf = Config(name='ai_scheduler_enabled', value=val)
        db.session.add(conf)
    db.session.commit()
    add_scheduler_log('INFO', f"管理员手动将 AI 自动提取定时任务状态更改为: {'【已启用】' if enabled else '【已禁用】'}")


def get_scheduler_cron():
    """获取配置的 Cron 表达式，默认 */5 * * * *"""
    conf = Config.query.filter_by(name='ai_scheduler_cron').first()
    if conf and conf.value and conf.value.strip():
        val = conf.value.strip()
        if croniter.is_valid(val):
            return val
    return _DEFAULT_CRON


def set_scheduler_cron(cron_expr: str):
    """设置并校验 Cron 表达式，写入数据库并重算下次执行时间"""
    cron_clean = cron_expr.strip()
    if not croniter.is_valid(cron_clean):
        raise ValueError(f"无效的 Cron 表达式: '{cron_clean}'。格式例如: '*/5 * * * *' 或 '0 * * * *'")

    conf = Config.query.filter_by(name='ai_scheduler_cron').first()
    if conf:
        conf.value = cron_clean
    else:
        conf = Config(name='ai_scheduler_cron', value=cron_clean)
        db.session.add(conf)
    db.session.commit()

    calc_next_run_time(cron_clean)
    add_scheduler_log('INFO', f"更新定时任务调度周期 Cron 表达式为: '{cron_clean}'，下次执行: {_NEXT_RUN_TIME}")
    return cron_clean


def get_scheduler_threads():
    """获取并发线程数配置，范围 1~10，默认 3"""
    conf = Config.query.filter_by(name='ai_scheduler_threads').first()
    if conf and conf.value:
        try:
            val = int(conf.value.strip())
            return max(1, min(10, val))
        except Exception:
            pass
    return _DEFAULT_THREADS


def set_scheduler_threads(thread_count: int):
    """设置并发线程数 (1~10) 并写入数据库"""
    count = max(1, min(10, int(thread_count)))
    conf = Config.query.filter_by(name='ai_scheduler_threads').first()
    if conf:
        conf.value = str(count)
    else:
        conf = Config(name='ai_scheduler_threads', value=str(count))
        db.session.add(conf)
    db.session.commit()
    add_scheduler_log('INFO', f"管理员将大模型并发处理线程数调整为: {count} 线程")
    return count


def calc_next_run_time(cron_expr: str = None):
    """计算下一次预定运行时间戳"""
    global _NEXT_RUN_TIME
    try:
        expr = cron_expr or get_scheduler_cron()
        itr = croniter(expr, datetime.now())
        next_dt = itr.get_next(datetime)
        _NEXT_RUN_TIME = next_dt.strftime('%Y-%m-%d %H:%M:%S')
        return _NEXT_RUN_TIME
    except Exception as e:
        logger.error(f"[AI Scheduler] 计算下次执行时间失败: {e}")
        _NEXT_RUN_TIME = None
        return None


def _process_single_post_in_thread(app, post_id: int):
    """在独立的线程与独立数据库 Session 上下文中安全处理单篇文章"""
    global _PROCESSED_COUNT
    with app.app_context():
        try:
            post = Posts.query.filter(Posts.id == post_id, Posts.deleted == 0).first()
            if not post:
                return False

            # 1. 检查是否已有分类
            existing_cat_count = PostCategories.query.filter(
                PostCategories.post_id == post.id,
                PostCategories.deleted == 0
            ).count()

            # 2. 检查是否已有标签
            existing_tag_count = PostTags.query.filter(
                PostTags.post_id == post.id,
                PostTags.deleted == 0
            ).count()

            need_taxonomy = (existing_cat_count == 0 or existing_tag_count == 0)
            need_summary = not (post.summary and post.summary.strip())

            if not need_taxonomy and not need_summary:
                return False

            content = (post.content or '').strip()
            title = (post.title or '').strip()
            if not content and not title:
                add_scheduler_log('WARN', f"文章 ID {post.id} 内容与标题为空，跳过处理")
                return False

            now = datetime.now()
            actions = []

            # 3. 执行自动分类与标签补充（只增不删）
            if need_taxonomy:
                try:
                    existing_categories = Categories.query.filter(Categories.deleted == 0).all()
                    existing_tags = Tags.query.filter(Tags.deleted == 0).all()
                    cat_names = [c.name for c in existing_categories]
                    tag_names = [t.name for t in existing_tags]

                    from apps.tools.ai_prompts import get_prompt_template
                    tpl = get_prompt_template('prompt_taxonomy')
                    system_prompt = tpl.replace('{category_list}', json.dumps(cat_names, ensure_ascii=False))\
                                       .replace('{tag_list}', json.dumps(tag_names, ensure_ascii=False))
                    user_prompt = f"文章标题：{title}\n\n正文节选：\n{content[:4000]}"
                    reply = llm_chat_completion(system_prompt, user_prompt, temperature=0.3, json_mode=True)
                    res = json.loads(reply)

                    rec_category = (res.get('category') or '').strip()
                    rec_tags = [t.strip() for t in res.get('tags', []) if t.strip()]

                    # 补充分类
                    if existing_cat_count == 0 and rec_category:
                        cat = Categories.query.filter(Categories.name == rec_category, Categories.deleted == 0).first()
                        if not cat:
                            import re
                            slug = re.sub(r'[^a-zA-Z0-9]', '', rec_category).lower() or f"cat-{int(now.timestamp())}"
                            cat = Categories(
                                name=rec_category,
                                slug=slug,
                                description=f"AI自动提取: {rec_category}",
                                color="#4f46e5",
                                parent_id=0,
                                deleted=0,
                                create_time=now,
                                update_time=now
                            )
                            db.session.add(cat)
                            db.session.flush()
                        pc = PostCategories(post_id=post.id, category_id=cat.id, deleted=0, create_time=now, update_time=now)
                        db.session.add(pc)
                        actions.append(f"绑定分类「{cat.name}」")

                    # 补充标签
                    if existing_tag_count == 0 and rec_tags:
                        added_tags = []
                        for tag_name in rec_tags:
                            tag = Tags.query.filter(Tags.name == tag_name, Tags.deleted == 0).first()
                            if not tag:
                                import re
                                slug = re.sub(r'[^a-zA-Z0-9]', '', tag_name).lower() or f"tag-{int(now.timestamp())}"
                                tag = Tags(
                                    name=tag_name,
                                    slug=slug,
                                    color="#06b6d4",
                                    deleted=0,
                                    create_time=now,
                                    update_time=now
                                )
                                db.session.add(tag)
                                db.session.flush()
                            exists_rel = PostTags.query.filter(PostTags.post_id == post.id, PostTags.tag_id == tag.id, PostTags.deleted == 0).first()
                            if not exists_rel:
                                pt = PostTags(post_id=post.id, tag_id=tag.id, deleted=0, create_time=now, update_time=now)
                                db.session.add(pt)
                                added_tags.append(tag.name)
                        if added_tags:
                            actions.append(f"绑定标签「{', '.join(added_tags)}」")

                except Exception as e:
                    add_scheduler_log('ERROR', f"文章 ID {post.id} 提取分类标签异常: {str(e)}")

            # 4. 执行自动摘要补充 (200字以内)
            if need_summary:
                try:
                    from apps.tools.ai_prompts import get_prompt_template
                    summary_sys = get_prompt_template('prompt_summary')
                    sum_res = llm_chat_completion(summary_sys, f"标题：{title}\n\n正文：\n{content[:6000]}", temperature=0.3).strip()
                    if len(sum_res) > 200:
                        sum_res = sum_res[:197] + '...'
                    post.summary = sum_res
                    actions.append("生成 200 字内精炼摘要")
                except Exception as e:
                    add_scheduler_log('ERROR', f"文章 ID {post.id} 生成摘要异常: {str(e)}")

            db.session.commit()
            with _SCHEDULER_LOCK:
                _PROCESSED_COUNT += 1

            if actions:
                add_scheduler_log('SUCCESS', f"文章 ID {post.id}「{post.title}」处理完成: {'; '.join(actions)}")
            return True

        except Exception as ex:
            db.session.rollback()
            add_scheduler_log('ERROR', f"线程处理文章 ID {post_id} 异常: {ex}")
            return False
        finally:
            db.session.remove()  # 显式清理工作线程复用时的 Session 状态，防脏上下文污染
            with _SCHEDULER_LOCK:
                _IN_FLIGHT_POST_IDS.discard(post_id)


def execute_batch_processing(app, is_manual: bool = False):
    """
    工业级防堆积批处理执行器：
    1. 互斥执行锁检测（若上一批还在执行，记录并安全跳过，坚决不重叠）；
    2. 扫描目标文章，自动剔除正在处理中的文章；
    3. 利用 ThreadPoolExecutor 并发处理。
    """
    global _IS_BATCH_RUNNING, _LAST_RUN_TIME
    with _SCHEDULER_LOCK:
        if _IS_BATCH_RUNNING:
            add_scheduler_log('WARN', "上一次调度批次仍在多线程处理中，本次周期自动跳过避让，防止任务积压与Token浪费")
            return {'msg': '上一批任务仍在多线程处理中，已自动跳过避免积压', 'count': 0, 'skipped': True}
        _IS_BATCH_RUNNING = True

    try:
        with app.app_context():
            _LAST_RUN_TIME = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            num_workers = get_scheduler_threads()

            # 扫描未分类文章
            posts_without_cats = (
                db.session.query(Posts.id)
                .outerjoin(PostCategories, (Posts.id == PostCategories.post_id) & (PostCategories.deleted == 0))
                .filter(Posts.deleted == 0, PostCategories.id.is_(None))
                .all()
            )
            target_ids = {row[0] for row in posts_without_cats}

            # 扫描未标签文章
            posts_without_tags = (
                db.session.query(Posts.id)
                .outerjoin(PostTags, (Posts.id == PostTags.post_id) & (PostTags.deleted == 0))
                .filter(Posts.deleted == 0, PostTags.id.is_(None))
                .all()
            )
            target_ids.update(row[0] for row in posts_without_tags)

            # 扫描缺少摘要文章
            posts_without_summary = (
                db.session.query(Posts.id)
                .filter(Posts.deleted == 0, (Posts.summary.is_(None) | (Posts.summary == '')))
                .limit(20)
                .all()
            )
            target_ids.update(row[0] for row in posts_without_summary)

            # 剔除在途正在被处理的文章
            with _SCHEDULER_LOCK:
                available_ids = [pid for pid in sorted(list(target_ids)) if pid not in _IN_FLIGHT_POST_IDS]

            if not available_ids:
                if is_manual:
                    add_scheduler_log('INFO', "手动扫描：所有文章均已具备分类、标签与摘要，无需处理")
                return {'msg': '所有文章均已具备分类、标签与摘要，无需处理', 'count': 0, 'skipped': False}

            # 单批处理数量：根据线程数灵活取 1~2 倍，平滑消耗
            batch_size = max(num_workers, min(10, num_workers * 2))
            selected_ids = available_ids[:batch_size]

            with _SCHEDULER_LOCK:
                for pid in selected_ids:
                    _IN_FLIGHT_POST_IDS.add(pid)

            add_scheduler_log('INFO', f"{'手动触发' if is_manual else '定时周期'}: 挑选 {len(selected_ids)} 篇未完善文章，启动 {num_workers} 线程并发分析...")

            success_count = 0
            with ThreadPoolExecutor(max_workers=num_workers, thread_name_prefix="AIWorker") as executor:
                futures = {executor.submit(_process_single_post_in_thread, app, pid): pid for pid in selected_ids}
                for future in as_completed(futures):
                    if future.result():
                        success_count += 1

            add_scheduler_log('INFO', f"批次完成：成功并发完善 {success_count} / {len(selected_ids)} 篇文章")
            return {'msg': f'批处理完成，成功并发完善 {success_count} 篇文章', 'count': success_count, 'skipped': False}

    finally:
        with _SCHEDULER_LOCK:
            _IS_BATCH_RUNNING = False


def trigger_scheduler_once():
    """手动立即执行一轮扫描分析"""
    global _GLOBAL_APP
    if not _GLOBAL_APP:
        return {'msg': '应用实例尚未准备就绪', 'count': 0, 'skipped': False}
    return execute_batch_processing(_GLOBAL_APP, is_manual=True)


def get_scheduler_status():
    """获取调度器当前整体运行健康度、Cron周期、线程数与防积压状态"""
    global _LAST_RUN_TIME, _NEXT_RUN_TIME, _PROCESSED_COUNT, _IS_BATCH_RUNNING, _IN_FLIGHT_POST_IDS
    with _GLOBAL_APP.app_context() if _GLOBAL_APP else None:
        enabled = is_scheduler_enabled()
        cron_expr = get_scheduler_cron()
        thread_count = get_scheduler_threads()
        if not _NEXT_RUN_TIME:
            calc_next_run_time(cron_expr)

        # 统计待处理文章数
        pending_cats = db.session.query(Posts.id).outerjoin(PostCategories, (Posts.id == PostCategories.post_id) & (PostCategories.deleted == 0)).filter(Posts.deleted == 0, PostCategories.id.is_(None)).count()
        pending_tags = db.session.query(Posts.id).outerjoin(PostTags, (Posts.id == PostTags.post_id) & (PostTags.deleted == 0)).filter(Posts.deleted == 0, PostTags.id.is_(None)).count()
        pending_summary = db.session.query(Posts.id).filter(Posts.deleted == 0, (Posts.summary.is_(None) | (Posts.summary == ''))).count()

    with _SCHEDULER_LOCK:
        batch_running = _IS_BATCH_RUNNING
        in_flight_len = len(_IN_FLIGHT_POST_IDS)

    return {
        'enabled': enabled,
        'cron': cron_expr,
        'threads': thread_count,
        'running': _SCHEDULER_THREAD is not None and _SCHEDULER_THREAD.is_alive(),
        'is_batch_running': batch_running,
        'in_flight_count': in_flight_len,
        'last_run_time': _LAST_RUN_TIME or '尚未执行',
        'next_run_time': _NEXT_RUN_TIME or '待计算',
        'processed_count': _PROCESSED_COUNT,
        'pending_categories_count': pending_cats,
        'pending_tags_count': pending_tags,
        'pending_summary_count': pending_summary,
        'total_pending': max(pending_cats, pending_tags, pending_summary)
    }


def run_scheduler_worker(app):
    """
    后台守护线程：基于 Cron 表达式动态计算下一次触发时间并休眠调度。
    具备互斥执行防积压机制，重叠时自动避让。
    """
    global _LAST_RUN_TIME, _NEXT_RUN_TIME
    time.sleep(5)
    add_scheduler_log('INFO', "AI 自动提取守护线程启动成功，防积压机制已就绪")

    while True:
        try:
            with app.app_context():
                if not is_scheduler_enabled():
                    time.sleep(10)
                    continue

                cron_expr = get_scheduler_cron()
                itr = croniter(cron_expr, datetime.now())
                next_epoch = itr.get_next()
                next_dt = datetime.fromtimestamp(next_epoch)
                _NEXT_RUN_TIME = next_dt.strftime('%Y-%m-%d %H:%M:%S')

            # 动态精准休眠，支持中途被禁用或 Cron 被修改
            while True:
                now_epoch = time.time()
                if now_epoch >= next_epoch:
                    break
                with app.app_context():
                    if not is_scheduler_enabled():
                        break
                    curr_cron = get_scheduler_cron()
                    if curr_cron != cron_expr:
                        break
                sleep_time = min(2.0, max(0.1, next_epoch - now_epoch))
                time.sleep(sleep_time)

            with app.app_context():
                if not is_scheduler_enabled():
                    continue

            # 触发多线程防积压批处理
            execute_batch_processing(app, is_manual=False)

        except Exception as e:
            add_scheduler_log('ERROR', f"定时调度守护循环异常: {e}")
            time.sleep(15)


def start_ai_scheduler(app):
    """启动后台守护调度线程。"""
    global _SCHEDULER_THREAD, _GLOBAL_APP
    _GLOBAL_APP = app
    _SCHEDULER_THREAD = threading.Thread(target=run_scheduler_worker, args=(app,), daemon=True, name="AISchedulerWorker")
    _SCHEDULER_THREAD.start()
    return _SCHEDULER_THREAD
