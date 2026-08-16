(async function () {
  try {
    const res = await fetch('https://www.nicelydone.qd.je/api/me', {
      method: 'GET',
      credentials: 'include'
    });

    const signInLink = document.querySelector('a[href="/auth.html"]');
    if (!signInLink) return;

    if (res.ok) {
      const user = await res.json();
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '10px';
      wrapper.innerHTML = `
        <span style="font-size:0.85rem;font-weight:600;">${user.username}</span>
        <button id="logoutBtn" style="font-size:0.8rem;padding:6px 12px;border-radius:6px;border:1px solid var(--color-border);background:var(--color-surface-offset);cursor:pointer;">Sign Out</button>
      `;
      signInLink.replaceWith(wrapper);

      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('https://www.nicelydone.qd.je/api/logout', {
          method: 'POST',
          credentials: 'include'
        });
        window.location.reload();
      });
    }
  } catch (e) {
    console.error('Auth check failed', e);
  }
})();