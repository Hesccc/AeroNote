import datetime
import time
import jwt
from flask import Blueprint, request, jsonify, current_app, g, redirect
import urllib.parse
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


# ──────────────────────────────────────────────
# OIDC 单点登录接口 (State / Nonce 防护 + 用户名映射绑定)
# ──────────────────────────────────────────────

@api_auth.route('/api/auth/oidc/status', methods=['GET'])
def oidc_status():
    """获取 OIDC 登录开关状态及按钮显示文案。"""
    from apps.tools.oidc import get_oidc_configs
    cfg = get_oidc_configs()
    return jsonify({
        'enabled': cfg.get('enabled', False),
        'button_text': '使用 OIDC 单点登录',
    })


@api_auth.route('/api/auth/oidc/auth-url', methods=['POST'])
def oidc_auth_url():
    """
    生成携带 State 与 Nonce 安全防护签名的 OIDC 认证跳转 URL。
    State: 防止跨站请求伪造 (CSRF) 攻击，具备 10 分钟有效时限与一次性防重放消费。
    Nonce: 注入授权请求，随后在 ID Token 回调时严格比对，防御令牌伪造与重放。
    """
    from apps.tools.oidc import get_oidc_configs, fetch_oidc_discovery, generate_state_and_nonce

    cfg = get_oidc_configs()
    if not cfg.get('enabled'):
        return jsonify({'msg': 'OIDC 单点登录尚未在后台启用！'}), 400

    issuer_url = cfg.get('issuer_url')
    client_id = cfg.get('client_id')
    if not issuer_url or not client_id:
        return jsonify({'msg': 'OIDC 服务配置不完整：请先在后台填写 Issuer URL 与 Client ID！'}), 400

    data = request.get_json() or {}
    redirect_uri = (data.get('redirect_uri') or cfg.get('redirect_uri') or '').strip()
    if not redirect_uri:
        redirect_uri = f"{request.host_url.rstrip('/')}/login/callback"

    try:
        discovery = fetch_oidc_discovery(issuer_url)
        auth_endpoint = discovery.get('authorization_endpoint')
        if not auth_endpoint:
            return jsonify({'msg': 'OIDC 服务发现未提供 authorization_endpoint！'}), 400

        state, nonce = generate_state_and_nonce(
            secret_key=current_app.config['SECRET_KEY'],
            redirect_uri=redirect_uri
        )

        params = {
            'client_id': client_id,
            'response_type': 'code',
            'scope': cfg.get('scopes', 'openid profile email'),
            'redirect_uri': redirect_uri,
            'state': state,
            'nonce': nonce,
        }

        separator = '&' if '?' in auth_endpoint else '?'
        full_auth_url = f"{auth_endpoint}{separator}{urllib.parse.urlencode(params)}"

        return jsonify({
            'auth_url': full_auth_url,
            'state': state,
        })
    except Exception as e:
        return jsonify({'msg': f'获取 OIDC 授权跳转地址失败: {str(e)}'}), 500


def _handle_oidc_callback(code: str, state: str, client_redirect_uri: str = '') -> dict:
    """核心 OIDC 回调处理逻辑，供 POST 与 GET 接口复用。"""
    from apps.tools.oidc import (
        get_oidc_configs,
        fetch_oidc_discovery,
        verify_and_consume_state,
        exchange_code_for_tokens,
        verify_nonce_in_id_token,
        fetch_userinfo,
        resolve_apps_admin_user,
        issue_user_jwt
    )

    cfg = get_oidc_configs()
    if not cfg.get('enabled'):
        raise ValueError("OIDC 单点登录尚未在后台启用！")

    # 1. 严格校验并消费 State，防止 CSRF 与重放攻击
    state_payload = verify_and_consume_state(state, current_app.config['SECRET_KEY'])
    expected_nonce = state_payload.get('nonce')
    state_redirect_uri = state_payload.get('redirect_uri')

    redirect_uri = client_redirect_uri or state_redirect_uri or f"{request.host_url.rstrip('/')}/login/callback"

    # 2. 请求服务发现与 Token 端点换取 Token
    discovery = fetch_oidc_discovery(cfg['issuer_url'])
    token_endpoint = discovery.get('token_endpoint')
    userinfo_endpoint = discovery.get('userinfo_endpoint')

    token_res = exchange_code_for_tokens(
        token_endpoint=token_endpoint,
        client_id=cfg['client_id'],
        client_secret=cfg['client_secret'],
        code=code,
        redirect_uri=redirect_uri
    )

    access_token = token_res.get('access_token')
    id_token = token_res.get('id_token')

    # 3. 校验 Nonce (防御 ID Token 重放攻击)
    if id_token:
        verify_nonce_in_id_token(id_token, expected_nonce)

    # 4. 获取 UserInfo 声明
    userinfo = {}
    if userinfo_endpoint and access_token:
        userinfo = fetch_userinfo(userinfo_endpoint, access_token)

    # 5. 用户名绑定决策与本地管理员解析
    matched_admin, oidc_user, err_reason = resolve_apps_admin_user(userinfo, id_token, cfg)
    if not matched_admin:
        raise PermissionError(err_reason)

    # 6. 签发本系统管理员 JWT Token
    auth_data = issue_user_jwt(matched_admin, current_app.config['SECRET_KEY'])
    return auth_data


@api_auth.route('/api/auth/oidc/callback', methods=['POST'])
def oidc_callback_post():
    """前端 SPA 发起的 OIDC 授权码兑换接口。"""
    data = request.get_json() or {}
    code = (data.get('code') or '').strip()
    state = (data.get('state') or '').strip()
    redirect_uri = (data.get('redirect_uri') or '').strip()

    if not code or not state:
        return jsonify({'msg': '回调参数不完整：缺失 code 或 state！'}), 400

    try:
        auth_data = _handle_oidc_callback(code, state, redirect_uri)
        return jsonify(auth_data)
    except PermissionError as e:
        return jsonify({'msg': str(e)}), 403
    except ValueError as e:
        return jsonify({'msg': str(e)}), 400
    except Exception as e:
        return jsonify({'msg': f'OIDC 登录鉴权失败: {str(e)}'}), 500


@api_auth.route('/api/auth/oidc/callback', methods=['GET'])
def oidc_callback_get():
    """浏览器直接跳转回后端的 OIDC 回调地址（自动跳转回前端 /login/callback）。"""
    code = request.args.get('code', '').strip()
    state = request.args.get('state', '').strip()
    error = request.args.get('error', '').strip()
    error_desc = request.args.get('error_description', '').strip()

    if error:
        err_msg = error_desc or error
        return redirect(f"/login/callback?error={urllib.parse.quote(err_msg)}")

    if not code or not state:
        return redirect(f"/login/callback?error={urllib.parse.quote('缺失 code 或 state 回调参数')}")

    try:
        auth_data = _handle_oidc_callback(code, state, request.base_url)
        return redirect(f"/login/callback?token={auth_data['token']}")
    except Exception as e:
        return redirect(f"/login/callback?error={urllib.parse.quote(str(e))}")


