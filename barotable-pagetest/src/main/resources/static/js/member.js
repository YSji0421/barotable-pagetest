/* 회원 로그인 (화면 확인용)
 * - 시연용 회원 계정은 data.js의 MEMBERS (member@example.com / barotable)
 * - 로그인 상태는 sessionStorage('bt.member')에 저장한다. 비밀번호는 저장하지 않는다.
 * - 로그인하면 손님 화면 위쪽에 이름과 로그아웃이 보이고, 예약자 정보 화면(confirm)에 이름·연락처·이메일이 미리 채워진다.
 * 실제 구현: POST /member/login, POST /member/logout (Spring Security, 역할 MEMBER)
 */
window.Member = (function () {
  const KEY = 'bt.member';
  const current = () => BT.sget(KEY, null);
  function login(email, password) {
    const e = String(email || '').trim().toLowerCase();
    const m = (BT_DATA.MEMBERS || []).find(x => x.email.toLowerCase() === e && x.password === password);
    if (!m) return null;
    const me = { email: m.email, name: m.name, phone: m.phone };
    BT.sset(KEY, me);
    return me;
  }
  const logout = () => BT.sremove(KEY);

  /* 위쪽 '회원 로그인' 버튼 → 로그인 중이면 '이름 님' + '로그아웃' */
  function renderHeader() {
    const me = current();
    document.querySelectorAll('.member-name').forEach(el => el.remove());
    document.querySelectorAll('a[data-go="member-login"]').forEach(a => {
      if (!a.dataset.label) a.dataset.label = a.textContent;
      if (!me) {
        a.textContent = a.dataset.label; a.removeAttribute('title'); a.href = BT.url('member-login'); delete a.dataset.member;
        return;
      }
      a.textContent = '로그아웃'; a.title = `${me.name} 님 로그아웃`; a.href = '#'; a.dataset.member = 'logout';
      if (a.closest('.site-head')) {
        const name = document.createElement('span');
        name.className = 'head-link member-name'; name.textContent = `${me.name} 님`;
        a.parentNode.insertBefore(name, a);
      }
    });
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-member="logout"]');
    if (!a) return;
    e.preventDefault(); e.stopPropagation();
    logout(); renderHeader(); BT.toast('로그아웃했어요');
  }, true);

  /* 회원 로그인 화면 */
  function initLoginPage() {
    const form = document.getElementById('member-login-form');
    if (!form) return;
    const msg = document.getElementById('member-login-message');
    const show = (text, good) => { msg.hidden = false; msg.textContent = text; msg.classList.toggle('good', !!good); };
    const me = current();
    if (me) show(`${me.name} 님으로 로그인되어 있어요. 다른 계정으로 로그인하면 바뀝니다.`, true);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const email = document.getElementById('member-email'), pw = document.getElementById('member-password');
      if (!email.value.trim() || !email.checkValidity()) { show('이메일 주소를 확인해 주세요.'); email.focus(); return; }
      if (!pw.value) { show('비밀번호를 입력해 주세요.'); pw.focus(); return; }
      const m = login(email.value, pw.value);
      if (!m) { show('이메일 또는 비밀번호가 맞지 않아요.'); pw.value = ''; pw.focus(); return; }
      BT.toast(`${m.name} 님, 환영합니다`);
      const next = new URLSearchParams(location.search).get('next');
      setTimeout(() => BT.go(['reserve', 'confirm', 'lookup'].includes(next) ? next : 'index'), 400);
    });
  }

  renderHeader();
  initLoginPage();
  return { current, login, logout };
})();
