const $=id=>document.getElementById(id);
const TEACHER_LOGIN_DOMAIN="akun.manuriska.sch.id";
let api;

function normalizeLogin(raw){
  const value=String(raw||"").trim().toLowerCase();
  if(value.includes("@"))return value;
  const username=value.replace(/[^a-z0-9._-]/g,"");
  return `${username}@${TEACHER_LOGIN_DOMAIN}`;
}
function setMessage(text,ok=false){
  const el=$("loginMessage");el.textContent=text||"";el.classList.toggle("ok",!!ok);
}
$("togglePassword").onclick=()=>{
  const p=$("password"),show=p.type==="password";p.type=show?"text":"password";$("togglePassword").textContent=show?"Sembunyikan":"Lihat";
};

(async()=>{
  try{
    api=await window.simanisReady;
    const existing=await api.auth.getSession();
    if(existing?.access_token){
      try{
        const rows=await api.db.select("profiles",`select=is_active,must_change_password&id=eq.${encodeURIComponent(existing.user.id)}&limit=1`);
        if(rows?.[0]?.is_active){
          location.href=rows[0].must_change_password?"account-security.html":"dashboard.html";return;
        }
      }catch(_){}
    }
    $("loginBtn").disabled=false;$("loginBtn").textContent="Masuk";
  }catch(err){
    setMessage("SIMANIS gagal disiapkan: "+err.message);
  }
})();

$("loginForm").onsubmit=async e=>{
  e.preventDefault();
  const btn=$("loginBtn"),raw=$("email").value,password=$("password").value;
  btn.disabled=true;btn.textContent="Masuk...";setMessage("");
  try{
    const session=await api.auth.signIn(normalizeLogin(raw),password);
    const rows=await api.db.select("profiles",`select=id,role,is_active,must_change_password&id=eq.${encodeURIComponent(session.user.id)}&limit=1`);
    const p=rows?.[0];
    if(!p)throw new Error("Profil akun belum terhubung ke SIMANIS.");
    if(!p.is_active){await api.auth.signOut();throw new Error("Akun SIMANIS sedang nonaktif.");}
    try{await api.db.rpc("mark_my_login",{})}catch(_){}
    location.href=p.must_change_password?"account-security.html":"dashboard.html";
  }catch(err){
    const msg=String(err.message||err);
    setMessage(/invalid login|invalid credentials/i.test(msg)?"Username/email atau password tidak sesuai.":msg);
    btn.disabled=false;btn.textContent="Masuk";
  }
};
