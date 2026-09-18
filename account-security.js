const $=id=>document.getElementById(id);
let api;
function msg(t,ok=false){const e=$("securityMessage");e.textContent=t||"";e.className="security-msg"+(ok?" ok":"")}
function strong(p){return p.length>=10&&/[A-Z]/.test(p)&&/[a-z]/.test(p)&&/[0-9]/.test(p)&&/[^A-Za-z0-9]/.test(p)}

(async()=>{
 try{
   api=await window.simanisReady;
   const user=await api.auth.getUser();
   if(!user){location.href="index.html";return}
   const rows=await api.db.select("profiles",`select=is_active,must_change_password&id=eq.${encodeURIComponent(user.id)}&limit=1`);
   if(!rows?.[0]?.is_active){await api.auth.signOut();location.href="index.html";return}
 }catch(err){msg("Gagal membuka keamanan akun: "+err.message)}
})();

$("passwordForm").onsubmit=async e=>{
 e.preventDefault();
 const p=$("newPassword").value,c=$("confirmPassword").value,btn=$("savePasswordBtn");
 if(!strong(p)){msg("Password belum memenuhi syarat keamanan.");return}
 if(p!==c){msg("Konfirmasi password tidak sama.");return}
 btn.disabled=true;btn.textContent="Menyimpan...";msg("");
 try{
   const session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login berakhir.");
   const cfg=window.SIMANIS_CONFIG;
   const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/auth/v1/user`,{
     method:"PUT",
     headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},
     body:JSON.stringify({password:p})
   });
   const text=await res.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
   if(!res.ok)throw new Error(body?.msg||body?.message||body?.error||text||`HTTP ${res.status}`);
   await api.db.rpc("complete_my_password_change",{});
   msg("Password berhasil diganti. Membuka dashboard...",true);
   setTimeout(()=>location.href="dashboard.html",700);
 }catch(err){msg("Gagal: "+err.message);btn.disabled=false;btn.textContent="Simpan Password"}
};
$("logoutBtn").onclick=async()=>{if(api)await api.auth.signOut();location.href="index.html"};
