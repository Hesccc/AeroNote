import datetime
import time
import jwt
from flask import Blueprint, request, jsonify, current_app, g
from apps.exts import db
from apps.models.model import User
from apps.tools.tools import verify_and_upgrade_password, generate_password
from .middleware import token_required

api_auth = Blueprint('api_auth', __name__)

# ─── 登录防暴力破解安全控制 (内存级速率限制与多重锁定) ───────────────────
_LOGIN_ATTEMPTS = {}  # key: (ip, username), value: {'count': int, 'locked_until': float, 'last_time': float}
MAX_FAILED_ATTEMPTS = 5      # 连续允许失败次数
LOCKOUT_SECONDS = 900        # 锁定时间：15 分钟
ATTEMPT_WINDOW_SECONDS = 300 # 失败计数统计窗口：5 分钟


def _check_and_record_failure(client_ip: str, username: str) -> tuple[bool, str]:
    """
    检查是否处于锁定状态；若未锁定则返回 (False, "")。
    若已锁定则返回 (True, 提示信息)。
    """
    key = (client_ip, username.lower())
    now = time.time()
    record = _LOGIN_ATTEMPTS.get(key)
    if record and now < record['locked_until']:
        remaining_min = int((record['locked_until'] - now) // 60) + 1
        return True, f'密码错误次数过多，账号已临时锁定，请 {remaining_min} 分钟后再试！'
    return False, ""


def _record_login_failure(client_ip: str, username: str) -> str:
    """记录一次登录失败并返回剩余重试机会提示。"""
    key = (client_ip, username.lower())
    now = time.time()
    record = _LOGIN_ATTEMPTS.get(key)

    if not record or (now - record.get('last_time', 0)) > ATTEMPT_WINDOW_SECONDS:
        record = {'count': 1, 'locked_until': 0.0, 'last_time': now}
    else:
        record['count'] += 1
        record['last_time'] = now

    if record['count'] >= MAX_FAILED_ATTEMPTS:
        record['locked_until'] = now + LOCKOUT_SECONDS
        _LOGIN_ATTEMPTS[key] = record
        return f'连续密码错误已达 {MAX_FAILED_ATTEMPTS} 次，账号已锁定 15 分钟！'

    _LOGIN_ATTEMPTS[key] = record
    remaining = MAX_FAILED_ATTEMPTS - record['count']
    return f'用户名或密码错误！剩余尝试次数: {remaining} 次'


def _clear_login_failure(client_ip: str, username: str):
    """登录成功，重置失败计数。"""
    key = (client_ip, username.lower())
    _LOGIN_ATTEMPTS.pop(key, None)
    # 周期性轻量清理过期记录，防止内存堆积
    if len(_LOGIN_ATTEMPTS) > 500:
        now = time.time()
        expired_keys = [k for k, v in _LOGIN_ATTEMPTS.items() if now > v.get('locked_until', 0) and (now - v.get('last_time', 0)) > ATTEMPT_WINDOW_SECONDS]
        for k in expired_keys:
            _LOGIN_ATTEMPTS.pop(k, None)


@api_auth.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password')
    client_ip = request.remote_addr or '127.0.0.1'

    if not username or not password:
        return jsonify({'msg': '用户名和密码不能为空！'}), 400

    # 1. 检查是否已被防爆破安全机制锁定
    is_locked, lock_msg = _check_and_record_failure(client_ip, username)
    if is_locked:
        return jsonify({'msg': lock_msg}), 429

    user = User.query.filter_by(username=username).first()
    # 统一模糊返回提示（防用户名枚举），并记录失败
    if not user or not verify_and_upgrade_password(user, password, db.session):
        fail_msg = _record_login_failure(client_ip, username)
        return jsonify({'msg': fail_msg}), 401

    # 登录成功，立即清除历史失败记录
    _clear_login_failure(client_ip, username)

    # Generate JWT token using timezone-aware UTC datetime
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    pwd_ts = int(user.update_time.timestamp()) if user.update_time else int(user.create_time.timestamp()) if user.create_time else 0
    token = jwt.encode({
        'username': user.username,
        'pwd_ts': pwd_ts,
        'exp': now_utc + datetime.timedelta(days=1)
    }, current_app.config['SECRET_KEY'], algorithm='HS256')
    
    return jsonify({
        'token': token,
        'username': user.username,
        'name': user.name,
        'email': user.email
    })

@api_auth.route('/api/auth/me', methods=['GET'])
@token_required
def me():
    return jsonify({
        'username': g.current_user.username,
        'name': g.current_user.name,
        'email': g.current_user.email,
        'description': g.current_user.description
    })

@api_auth.route('/api/manage/user/password', methods=['PUT'])
@token_required
def change_password():
    data = request.get_json() or {}
    old_password = data.get('old_password')
    new_password = data.get('new_password')

    if not old_password or not new_password:
        return jsonify({'msg': '原密码与新密码均不能为空'}), 400

    if len(new_password) < 8:
        return jsonify({'msg': '新密码长度至少需要 8 位'}), 400

    user = g.current_user
    if not verify_and_upgrade_password(user, old_password, db.session):
        return jsonify({'msg': '原密码错误，请核对后重试'}), 400

    user.password = generate_password(new_password)
    user.update_time = datetime.datetime.now()
    db.session.commit()

    return jsonify({'msg': '密码修改成功，请使用新密码重新登录'})

