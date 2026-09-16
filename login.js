const form = document.getElementById("loginForm");
const btn = document.getElementById("loginBtn");
const msg = document.getElementById("loginMessage");
const pwd = document.getElementById("password");
const toggle = document.getElementById("togglePassword");

function showMessage(text, ok = false) {
  msg.textContent = text || "";
  msg.style.color = ok ? "#0b7347" : "#e64234";
}

toggle.addEventListener("click", () => {
  pwd.type = pwd.type === "password" ? "text" : "password";
  toggle.textContent = pwd.type === "password" ? "Lihat" : "Sembunyikan";
});

(async function bootLogin() {
  try {
    const api = await window.simanisReady;
    const existing = await api.auth.getSession();

    if (existing) {
      location.replace("dashboard.html");
      return;
    }

    btn.disabled = false;
    btn.textContent = "Masuk";
    showMessage("");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value.trim();
      const password = pwd.value;

      if (!email || !password) {
        showMessage("Email dan password wajib diisi.");
        return;
      }

      btn.disabled = true;
      btn.textContent = "Memproses...";
      showMessage("Menghubungkan ke SIMANIS...", true);

      try {
        await api.auth.signIn(email, password);
        showMessage("Login berhasil. Membuka dashboard...", true);
        location.replace("dashboard.html");
      } catch (err) {
        const text = String(err.message || err);
        if (/invalid login credentials/i.test(text)) {
          showMessage("Email atau password salah.");
        } else if (/failed to fetch/i.test(text)) {
          showMessage("Koneksi ke server Supabase gagal. Coba ganti jaringan atau muat ulang.");
        } else {
          showMessage("Login gagal: " + text);
        }
      } finally {
        btn.disabled = false;
        btn.textContent = "Masuk";
      }
    });
  } catch (err) {
    showMessage("SIMANIS gagal disiapkan: " + (err.message || err));
    btn.disabled = true;
  }
})();
