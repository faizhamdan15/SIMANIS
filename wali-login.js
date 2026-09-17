const $=id=>document.getElementById(id);
const PENDING_KEY="simanis-guardian-pending-invite";
const SESSION_KEY="simanis-session";

function cfg(){return window.SIMANIS_CONFIG}
function base(){return cfg().SUPABASE_URL.replace(/\/$/,"")}
function headers(token=null){const h={apikey:cfg().SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"};if(token)h.Authorization=`Bearer ${token}`;return h}
async function parse(res){const text=await res.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}if(!res.ok)throw new Error(body?.msg||body?.message||body?.error_description||body?.error||text||`HTTP ${res.status}`);return body}
function saveSession(body){
 const session={access_token:body.access_token,refresh_token:body.refresh_token,expires_in:body.expires_in,expires_at:Math.floor(Date.now()/1000)+(body.expires_in||3600),token_type:body.token_type||"bearer",user:body.user};
 localStorage.setItem(SESSION_KEY,JSON.stringify(session));
}
function setTab(name){
 document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
 $("loginForm").classList.toggle("hidden",name!=="login");$("activateForm").classList.toggle("hidden",name!=="activate");
}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));

$("loginForm").onsubmit=async e=>{
 e.preventDefault();const btn=$("loginBtn");btn.disabled=true;btn.textContent="Masuk...";$("loginMessage").textContent="";
 try{
  const api=await window.simanisReady;await api.auth.signIn($("loginEmail").value.trim(),$("loginPassword").value);
  location.href="wali.html";
 }catch(err){$("loginMessage").textContent="Gagal masuk: "+err.message}
 finally{btn.disabled=false;btn.textContent="Masuk ke Portal"}
};

$("activateForm").onsubmit=async e=>{
 e.preventDefault();const btn=$("activateBtn");btn.disabled=true;btn.textContent="Membuat akun...";$("activateMessage").className="message";$("activateMessage").textContent="";
 const pending={code:$("inviteCode").value.trim().toUpperCase(),name:$("guardianName").value.trim(),phone:$("guardianPhone").value.trim()};
 try{
  const email=$("signupEmail").value.trim(),password=$("signupPassword").value;
  const res=await fetch(`${base()}/auth/v1/signup`,{method:"POST",headers:headers(),body:JSON.stringify({email,password})});
  const body=await parse(res);localStorage.setItem(PENDING_KEY,JSON.stringify(pending));
  if(body.access_token){
   saveSession(body);location.href="wali.html";
  }else{
   $("activateMessage").className="message ok";
   $("activateMessage").textContent="Akun dibuat. Silakan konfirmasi email jika diminta, lalu masuk menggunakan tab Masuk. Kode aktivasi sudah disimpan untuk diproses otomatis.";
   setTab("login");$("loginEmail").value=email;
  }
 }catch(err){$("activateMessage").textContent="Aktivasi gagal: "+err.message}
 finally{btn.disabled=false;btn.textContent="Buat & Aktivasi Akun"}
};