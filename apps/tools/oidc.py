import time
import secrets
import threading
from datetime import datetime, timezone, timedelta
import requests
import jwt
from flask import current_app
from apps.exts import db
from apps.models.model import Config, User
from apps.tools.logger import api_logger, app_logger

# ─── OIDC 发现文档缓存 (内存缓存 30 分钟，减少频繁网络请求) ───
_DISCOVERY_CACHE = {}  # key: issuer_url, value: {'data': dict, 'expires_at': float}
_CACHE_LOCK = threading.Lock()

# ─── State 一次性防重放消费记录 (带过期 TTL 清理) ───
_CONSUMED_STATES = {}  # key: state_rnd_hash, value: expire_timestamp
_CONSUMED_LOCK = threading.Lock()


def _cleanup_consumed_states():
    """定期清理已过期的 state 记录，防止内存泄漏。"""
    now = time.time()
    with _CONSUMED_LOCK:
        expired = [k for k, exp in _CONSUMED_STATES.items() if now > exp]
        for k in expired:
            _CONSUMED_STATES.pop(k, None)


def get_oidc_configs() -> dict:
    """从数据库 config 表获取全量 OIDC 运行时配置。"""
    configs = Config.query.filter(Config.name.like('oidc_%')).all()
    cfg_map = {c.name: (c.value or '').strip() for c in configs}

    return {
        'enabled': cfg_map.get('oidc_enabled', 'false').lower() in ('true', '1', 'yes'),
        'issuer_url': cfg_map.get('oidc_issuer_url', '').rstrip('/'),
        'client_id': cfg_map.get('oidc_client_id', ''),
        'client_secret': cfg_map.get('oidc_client_secret', ''),
        'redirect_uri': cfg_map.get('oidc_redirect_uri', ''),
        'scopes': cfg_map.get('oidc_scopes', 'openid profile email') or 'openid profile email',
        'claim_field': cfg_map.get('oidc_claim_field', 'preferred_username') or 'preferred_username',
        'bound_username': cfg_map.get('oidc_bound_username', ''),
        'bound_admin': cfg_map.get('oidc_bound_admin', 'admin') or 'admin',
        'bound_mappings': cfg_map.get('oidc_bound_mappings', ''),
        'auto_match_username': cfg_map.get('oidc_auto_match_username', 'false').lower() in ('true', '1', 'yes'),
    }


def fetch_oidc_discovery(issuer_url: str, timeout: float = 10.0, force_refresh: bool = False) -> dict:
    """
    请求 OIDC 服务发现接口 (/.well-known/openid-configuration) 并解析端点。
    内置 30 分钟内存缓存，支持 force_refresh 强制刷新。
    """
    clean_url = issuer_url.strip().rstrip('/')
    if not clean_url:
        raise ValueError("OIDC Issuer URL 不能为空！")

    now = time.time()
    if not force_refresh:
        with _CACHE_LOCK:
            cached = _DISCOVERY_CACHE.get(clean_url)
            if cached and cached['expires_at'] > now:
                return cached['data']

    discovery_url = f"{clean_url}/.well-known/openid-configuration"
    try:
        resp = requests.get(
            discovery_url,
            headers={'Accept': 'application/json', 'User-Agent': 'AeroNote-OIDC/1.0'},
            timeout=timeout
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.exceptions.Timeout:
        raise TimeoutError(f"请求 OIDC 发现端点超时 ({timeout}s): {discovery_url}")
    except requests.exceptions.RequestException as e:
        raise ConnectionError(f"无法连接到 OIDC 发现端点 [{discovery_url}]: {str(e)}")
    except Exception as e:
        raise ValueError(f"解析 OIDC 发现文档失败: {str(e)}")

    # 校验必要端点
    if 'authorization_endpoint' not in data or 'token_endpoint' not in data:
        raise ValueError("OIDC 发现文档中缺失 authorization_endpoint 或 token_endpoint！")

    with _CACHE_LOCK:
        _DISCOVERY_CACHE[clean_url] = {
            'data': data,
            'expires_at': now + 1800  # 30 分钟缓存
        }

    return data


def test_oidc_connectivity(issuer_url: str, client_id: str = '', client_secret: str = '') -> dict:
    """
    网络连通性探测诊断工具：
    1. 测量到 /.well-known/openid-configuration 的 HTTP 握手延迟
    2. 提取并校验各类认证、令牌、用户信息与 JWKS 端点
    3. 返回详细的诊断与就绪状态报告
    """
    start_time = time.time()
    try:
        discovery = fetch_oidc_discovery(issuer_url, timeout=10.0, force_refresh=True)
        latency_ms = round((time.time() - start_time) * 1000, 1)

        endpoints = {
            'discovery': f"{issuer_url.strip().rstrip('/')}/.well-known/openid-configuration",
            'authorization_endpoint': discovery.get('authorization_endpoint', '未提供'),
            'token_endpoint': discovery.get('token_endpoint', '未提供'),
            'userinfo_endpoint': discovery.get('userinfo_endpoint', '未提供'),
            'jwks_uri': discovery.get('jwks_uri', '未提供'),
            'response_types_supported': discovery.get('response_types_supported', []),
            'scopes_supported': discovery.get('scopes_supported', [])
        }

        # 检查是否提供了完整的 Client ID & Secret
        credentials_status = "未提供客户端密钥，仅完成服务端点发现探测"
        if client_id and client_secret:
            credentials_status = f"已填写客户端凭据 (Client ID: {client_id[:6]}...)"

        return {
            'success': True,
            'msg': f"OIDC 身份发现端点握手成功！(网络延迟: {latency_ms}ms)",
            'latency_ms': latency_ms,
            'issuer': discovery.get('issuer', issuer_url),
            'credentials_status': credentials_status,
            'endpoints': endpoints
        }
    except Exception as e:
        latency_ms = round((time.time() - start_time) * 1000, 1)
        return {
            'success': False,
            'msg': f"连通性探测失败: {str(e)}",
            'latency_ms': latency_ms,
            'endpoints': None
        }


# ──────────────────────────────────────────────
# State & Nonce 防护引擎 (防御 CSRF 攻击与 ID Token 重放攻击)
# ──────────────────────────────────────────────

def generate_state_and_nonce(secret_key: str, redirect_uri: str) -> tuple[str, str]:
    """
    生成带防篡改数字签名的 State 与高熵 Nonce。
    - State: 包含防重放唯一标识 (rnd)、Nonce 哈希、有效截止期 (10分钟) 并由 SECRET_KEY 签名
    - Nonce: 密码学高熵安全伪随机串 (24 字节 URL-safe)
    """
    _cleanup_consumed_states()

    rnd_id = secrets.token_hex(16)
    nonce = secrets.token_urlsafe(24)
    now = int(time.time())
    exp = now + 600  # 10 分钟有效期

    payload = {
        'rnd': rnd_id,
        'nonce': nonce,
        'redirect_uri': redirect_uri,
        'iat': now,
        'exp': exp
    }

    state_token = jwt.encode(payload, secret_key, algorithm='HS256')
    return state_token, nonce


def verify_and_consume_state(state_token: str, secret_key: str) -> dict:
    """
    校验 State 防篡改签名、有效期限并实行一次性消费 (One-time use)。
    成功返回解码后的 payload (内含 nonce 与 redirect_uri)；若已过期或已被消费则抛出安全异常。
    """
    _cleanup_consumed_states()

    if not state_token:
        raise ValueError("缺失 State 参数，可能受到跨站请求伪造 (CSRF) 攻击！")

    try:
        payload = jwt.decode(state_token, secret_key, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        raise ValueError("OIDC 登录会话已超时 (有效期 10 分钟)，请返回登录页重新发起！")
    except jwt.InvalidTokenError:
        raise ValueError("State 签名无效或已被篡改，CSRF 校验失败！")

    rnd_id = payload.get('rnd')
    if not rnd_id:
        raise ValueError("State 结构异常，缺失唯一追踪标识！")

    # 一次性防重放检查
    with _CONSUMED_LOCK:
        if rnd_id in _CONSUMED_STATES:
            api_logger.error(f"[OIDC 防护告警] 检测到 State 重放攻击！rnd_id: {rnd_id}")
            raise ValueError("检测到登录请求重放！此登录链接已被使用，请重新发起登录！")
        _CONSUMED_STATES[rnd_id] = payload.get('exp', time.time() + 600)

    return payload


def verify_nonce_in_id_token(id_token: str, expected_nonce: str):
    """
    校验 OIDC ID Token 中的 Nonce 字段，防御中间人及重放攻击。
    """
    if not id_token or not expected_nonce:
        return

    try:
        # 解码 ID Token payload 进行 Nonce 声明比对
        unverified_payload = jwt.decode(id_token, options={"verify_signature": False})
        token_nonce = unverified_payload.get('nonce')
        if token_nonce and token_nonce != expected_nonce:
            api_logger.error(f"[OIDC 防护告警] Nonce 不匹配！期望值: {expected_nonce}, 实际值: {token_nonce}")
            raise ValueError("ID Token 中的 Nonce 校验失败，该响应可能已被窃取或重放！")
    except jwt.PyJWTError as e:
        api_logger.warning(f"ID Token 解析校验遇到警告: {e}")


# ──────────────────────────────────────────────
# 令牌换取与用户信息提取
# ──────────────────────────────────────────────

def exchange_code_for_tokens(token_endpoint: str, client_id: str, client_secret: str, code: str, redirect_uri: str) -> dict:
    """向 OIDC Token 端点换取 access_token 与 id_token。"""
    token_data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirect_uri,
        'client_id': client_id,
        'client_secret': client_secret,
    }
    headers = {
        'Accept': 'application/json',
        'User-Agent': 'AeroNote-OIDC/1.0',
    }

    try:
        resp = requests.post(token_endpoint, data=token_data, headers=headers, timeout=15.0)
        resp_json = resp.json()
        if resp.status_code != 200:
            error_desc = resp_json.get('error_description') or resp_json.get('error') or resp.text
            raise ValueError(f"换取 OIDC Token 失败 (HTTP {resp.status_code}): {error_desc}")
        return resp_json
    except requests.exceptions.RequestException as e:
        raise ConnectionError(f"请求 OIDC Token 端点网络失败: {str(e)}")


def fetch_userinfo(userinfo_endpoint: str, access_token: str) -> dict:
    """请求 OIDC UserInfo 端点获取已认证用户的详细声明。"""
    if not userinfo_endpoint:
        return {}

    try:
        resp = requests.get(
            userinfo_endpoint,
            headers={
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/json',
                'User-Agent': 'AeroNote-OIDC/1.0',
            },
            timeout=10.0
        )
        if resp.status_code == 200:
            return resp.json()
        api_logger.warning(f"请求 UserInfo 端点返回非 200 状态 (HTTP {resp.status_code}): {resp.text}")
        return {}
    except Exception as e:
        api_logger.warning(f"请求 UserInfo 端点失败: {e}")
        return {}


# ──────────────────────────────────────────────
# 用户名映射与绑定引擎 (oidc user -> Apps admin)
# ──────────────────────────────────────────────

def parse_bound_mappings(mappings_text: str) -> dict[str, str]:
    """
    解析管理员在后台配置的多行或多规则绑定文本。
    支持格式：
      oidc_user1:admin
      oidc_user2 = admin
      oidc_user3 -> admin
    """
    mapping = {}
    if not mappings_text:
        return mapping

    for line in mappings_text.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        # 支持冒号、等号或箭头分隔
        parts = None
        for sep in (':', '=', '->'):
            if sep in line:
                parts = [p.strip() for p in line.split(sep, 1)]
                break
        if parts and len(parts) == 2 and parts[0] and parts[1]:
            mapping[parts[0].lower()] = parts[1]

    return mapping


def resolve_apps_admin_user(userinfo: dict, id_token: str, oidc_config: dict) -> tuple[User | None, str, str]:
    """
    核心用户绑定决策引擎：
    根据 claim_field 提取 OIDC 用户标识，查验配置规则并映射至本地 User (Apps admin)。

    返回: (matched_user: User | None, oidc_identifier: str, error_reason: str)
    """
    # 提取 ID Token claims 作为备选
    id_claims = {}
    if id_token:
        try:
            id_claims = jwt.decode(id_token, options={"verify_signature": False})
        except Exception:
            pass

    # 1. 提取 OIDC 身份字段
    claim_field = oidc_config.get('claim_field') or 'preferred_username'
    oidc_user = (
        userinfo.get(claim_field)
        or id_claims.get(claim_field)
        or userinfo.get('preferred_username')
        or userinfo.get('email')
        or userinfo.get('sub')
        or id_claims.get('sub')
        or ''
    )
    oidc_user = str(oidc_user).strip()

    if not oidc_user:
        return None, "", f"无法从 OIDC 返回的声明中获取用户身份标识 (尝试匹配声明: {claim_field})！"

    oidc_user_lower = oidc_user.lower()
    target_admin_username = None

    # 2. 匹配顺序 A: 检查后台高级多规则映射 (oidc_bound_mappings)
    mappings = parse_bound_mappings(oidc_config.get('bound_mappings', ''))
    if oidc_user_lower in mappings:
        target_admin_username = mappings[oidc_user_lower]

    # 3. 匹配顺序 B: 检查后台单一默认绑定规则 (oidc_bound_username -> oidc_bound_admin)
    if not target_admin_username:
        configured_bound_user = (oidc_config.get('bound_username') or '').strip().lower()
        configured_bound_admin = (oidc_config.get('bound_admin') or '').strip()
        if configured_bound_user and configured_bound_admin:
            if oidc_user_lower == configured_bound_user:
                target_admin_username = configured_bound_admin

    # 4. 匹配顺序 C: 同名自动匹配 (若开启 oidc_auto_match_username)
    if not target_admin_username and oidc_config.get('auto_match_username'):
        existing_user = User.query.filter_by(username=oidc_user, deleted=0).first()
        if existing_user:
            target_admin_username = existing_user.username

    # 5. 若未匹配到任何管理员映射，坚决拦截
    if not target_admin_username:
        api_logger.warning(f"[OIDC 鉴权拦截] 外部 OIDC 用户 [{oidc_user}] 尝试登录，但未与任何博客管理员账号绑定！")
        return (
            None,
            oidc_user,
            f"外部 OIDC 账号 [{oidc_user}] 未与本站管理员账号绑定，拒绝访问！请联系站长在后台「系统设置」->「OIDC 单点登录」中配置绑定关系。"
        )

    # 6. 查询本地数据库管理员用户
    admin_user = User.query.filter_by(username=target_admin_username, deleted=0).first()
    if not admin_user:
        api_logger.error(f"[OIDC 鉴权错误] 映射的目标管理员账号 [{target_admin_username}] 在本地数据库不存在或已被软删除！")
        return (
            None,
            oidc_user,
            f"绑定的本地管理员账号 [{target_admin_username}] 在系统中不存在或已被停用！"
        )

    return admin_user, oidc_user, ""


def issue_user_jwt(user: User, secret_key: str) -> dict:
    """复用系统原生 JWT 签发标准生成登录 Token。"""
    now_utc = datetime.now(timezone.utc)
    pwd_ts = int(user.update_time.timestamp()) if user.update_time else int(user.create_time.timestamp()) if user.create_time else 0
    token = jwt.encode({
        'username': user.username,
        'pwd_ts': pwd_ts,
        'exp': now_utc + timedelta(days=1)
    }, secret_key, algorithm='HS256')

    return {
        'token': token,
        'username': user.username,
        'name': user.name,
        'email': user.email
    }
