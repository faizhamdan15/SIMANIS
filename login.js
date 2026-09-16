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

window.addEventListener("error", (e) => {
  console.error(e.error || e.message);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error(e.reason);
});

(async function bootLogin() {
  try {
    showMessage("Menyiapkan koneksi...", true);
    const { supabase } = await window.simanisReady;

    const { data, error } = await supabase.auth.getSession();
    if (error) console.warn(error);

    if (data?.session) {
      location.replace("dashboard.html");
      return;
    }

    showMessage("");
    btn.disabled = false;

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
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          showMessage(
            error.message === "Invalid login credentials"
              ? "Email atau password salah."
              : "Login gagal: " + error.message
          );
          return;
        }

        if (!data?.session) {
          showMessage("Login belum menghasilkan sesi. Silakan coba lagi.");
          return;
        }

        showMessage("Login berhasil. Membuka dashboard...", true);
        location.replace("dashboard.html");
      } catch (err) {
        console.error(err);
        showMessage("Tidak dapat terhubung ke Supabase. Periksa koneksi lalu coba lagi.");
      } finally {
        btn.disabled = false;
        btn.textContent = "Masuk";
      }
    });
  } catch (err) {
    console.error(err);
    showMessage(err.message || "Gagal menyiapkan koneksi SIMANIS.");
    btn.disabled = true;
  }
})();
