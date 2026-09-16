const { supabase } = window.simanis;

async function redirectIfLoggedIn() {
  const { data } = await supabase.auth.getSession();
  if (data.session) location.href = "dashboard.html";
}
redirectIfLoggedIn();

const form = document.getElementById("loginForm");
const btn = document.getElementById("loginBtn");
const msg = document.getElementById("loginMessage");
const pwd = document.getElementById("password");

document.getElementById("togglePassword").addEventListener("click", () => {
  pwd.type = pwd.type === "password" ? "text" : "password";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";
  btn.disabled = true;
  btn.textContent = "Memproses...";

  const email = document.getElementById("email").value.trim();
  const password = pwd.value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    msg.textContent = error.message === "Invalid login credentials"
      ? "Email atau password salah."
      : error.message;
    btn.disabled = false;
    btn.textContent = "Masuk";
    return;
  }

  if (data.session) location.href = "dashboard.html";
});
