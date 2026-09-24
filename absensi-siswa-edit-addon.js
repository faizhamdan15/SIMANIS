(function(){
  const page=(location.pathname.split("/").pop()||"").toLowerCase();
  if(page!=="absensi-siswa.html")return;

  let installed=false;
  let hasSavedAttendance=false;
  let editMode=false;
  let editSnapshot=null;
  let editContext=null;
  let applying=false;
  let pendingAudit=null;
  let rpcHookInstalled=false;

  const COMPLETE_STATUSES=new Set(["HADIR","TERLAMBAT","IZIN","SAKIT","ALFA"]);
  const AUDIT_FIELDS=["attendance_status","arrival_time","late_minutes","note"];

  function clone(v){
    try{return structuredClone(v)}
    catch(_){return JSON.parse(JSON.stringify(v))}
  }

  function completeFromRows(){
    return Array.isArray(rows)
      && rows.length>0
      && rows.every(r=>COMPLETE_STATUSES.has(String(r.attendance_status||"")));
  }

  function canManage(){
    return !!selectedClass?.can_manage;
  }

  function locked(){
    return canManage() && hasSavedAttendance && !editMode;
  }

  function normRow(r){
    return {
      attendance_status:String(r?.attendance_status||"BELUM_DIABSEN"),
      arrival_time:r?.arrival_time?String(r.arrival_time).slice(0,5):null,
      late_minutes:Number(r?.late_minutes||0),
      note:r?.note==null||String(r.note).trim()===""?null:String(r.note)
    };
  }

  function buildChanges(){
    if(!Array.isArray(editSnapshot)||!Array.isArray(rows))return [];

    const beforeMap=new Map(editSnapshot.map(r=>[String(r.enrollment_id),r]));
    const changes=[];

    rows.forEach(afterRow=>{
      const beforeRow=beforeMap.get(String(afterRow.enrollment_id));
      if(!beforeRow)return;

      const before=normRow(beforeRow);
      const after=normRow(afterRow);
      const changedFields=AUDIT_FIELDS.filter(k=>before[k]!==after[k]);

      if(!changedFields.length)return;

      changes.push({
        enrollment_id:afterRow.enrollment_id,
        student_name:afterRow.full_name||beforeRow.full_name||"",
        nis:afterRow.nis||beforeRow.nis||"",
        nisn:afterRow.nisn||beforeRow.nisn||"",
        changed_fields:changedFields,
        before,
        after
      });
    });

    return changes;
  }

  function showToast(message,type="ok"){
    let box=document.getElementById("studentAttendanceAuditToast");
    if(!box){
      box=document.createElement("div");
      box.id="studentAttendanceAuditToast";
      box.style.cssText="position:fixed;right:18px;bottom:18px;z-index:99999;max-width:360px;padding:12px 14px;border-radius:12px;font:700 10px Inter,Arial,sans-serif;box-shadow:0 14px 35px rgba(0,0,0,.18);transition:.2s";
      document.body.appendChild(box);
    }
    box.textContent=message;
    box.style.background=type==="warn"?"#fff4d7":"#e5f6eb";
    box.style.color=type==="warn"?"#8a5a00":"#166534";
    box.style.opacity="1";
    clearTimeout(box._timer);
    box._timer=setTimeout(()=>{box.style.opacity="0"},4200);
  }

  function historyUrl(){
    const d=document.getElementById("attendanceDate")?.value||"";
    const c=selectedClass?.class_id||"";
    const qs=new URLSearchParams();
    if(d)qs.set("date",d);
    if(c)qs.set("class",c);
    return "absensi-siswa-riwayat.html"+(qs.toString()?`?${qs.toString()}`:"");
  }

  function ensureUI(){
    if(document.getElementById("studentAttendanceEditTools"))return;

    const style=document.createElement("style");
    style.textContent=`
      .sa-saved-notice{display:none;margin:0 0 14px;border-radius:14px;padding:12px 14px;border:1px solid #cfe4d8;background:#f3fbf6}
      .sa-saved-notice.show{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .sa-saved-notice.editing{border-color:#efd28a;background:#fff9e8}
      .sa-saved-notice strong{display:block;font-size:11px;color:#075b3a}
      .sa-saved-notice.editing strong{color:#8a5a00}
      .sa-saved-notice span{display:block;margin-top:3px;font-size:9px;color:#65736b}
      .sa-lock-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;font-size:8px;font-weight:800;background:#dff4e7;color:#08743f}
      .sa-lock-badge.editing{background:#fff0c9;color:#8a5a00}
      .sa-edit-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .sa-edit-tools button{border:1px solid #d7e2dc;background:#fff;color:#075b3a;border-radius:10px;padding:10px 12px;font-size:10px;font-weight:800;cursor:pointer}
      .sa-edit-tools .edit{background:#075b3a;color:#fff;border-color:#075b3a}
      .sa-edit-tools .cancel{color:#8a5a00}
      .sa-edit-tools .history{color:#365aaf;border-color:#ccd8ef}
      .sa-edit-tools button.hidden{display:none}
      .sa-locked-field{background:#f5f7f6!important;color:#6b746f!important;cursor:not-allowed!important}
    `;
    document.head.appendChild(style);

    const quick=document.querySelector(".quick-actions");
    if(quick){
      const notice=document.createElement("div");
      notice.id="studentAttendanceSavedNotice";
      notice.className="sa-saved-notice";
      notice.innerHTML=`
        <div>
          <strong id="studentAttendanceSavedTitle">Absensi sudah tersimpan</strong>
          <span id="studentAttendanceSavedText">Klik Edit Absensi jika ada data yang perlu diperbaiki.</span>
        </div>
        <span id="studentAttendanceSavedBadge" class="sa-lock-badge">TERKUNCI</span>
      `;
      quick.parentNode.insertBefore(notice,quick);
    }

    const saveBar=document.querySelector(".save-bar");
    if(saveBar){
      const tools=document.createElement("div");
      tools.id="studentAttendanceEditTools";
      tools.className="sa-edit-tools";
      tools.innerHTML=`
        <button type="button" id="attendanceHistoryBtn" class="history">Riwayat Perubahan</button>
        <button type="button" id="cancelAttendanceEditBtn" class="cancel hidden">Batalkan Edit</button>
        <button type="button" id="editAttendanceBtn" class="edit hidden">Edit Absensi</button>
      `;
      saveBar.appendChild(tools);

      document.getElementById("editAttendanceBtn").addEventListener("click",startEdit);
      document.getElementById("cancelAttendanceEditBtn").addEventListener("click",cancelEdit);
      document.getElementById("attendanceHistoryBtn").addEventListener("click",()=>location.href=historyUrl());
    }
  }

  function setFormDisabled(disabled){
    if(applying)return;
    applying=true;
    try{
      document.querySelectorAll('#attendanceBody [data-field], #attendanceCards [data-field]').forEach(el=>{
        el.disabled=disabled || !canManage();
        el.classList.toggle("sa-locked-field",disabled && canManage());
      });

      ["markAllPresent","markEmptyPresent","markEmptyAbsent"].forEach(id=>{
        const el=document.getElementById(id);
        if(el)el.disabled=!canManage() || disabled;
      });
    }finally{
      applying=false;
    }
  }

  function applyUI(){
    ensureUI();

    const notice=document.getElementById("studentAttendanceSavedNotice");
    const noticeTitle=document.getElementById("studentAttendanceSavedTitle");
    const noticeText=document.getElementById("studentAttendanceSavedText");
    const badge=document.getElementById("studentAttendanceSavedBadge");
    const editBtn=document.getElementById("editAttendanceBtn");
    const cancelBtn=document.getElementById("cancelAttendanceEditBtn");
    const historyBtn=document.getElementById("attendanceHistoryBtn");
    const saveBtn=document.getElementById("saveBtn");

    if(!notice || !saveBtn)return;

    if(historyBtn)historyBtn.style.display=selectedClass?"":"none";

    if(locked()){
      notice.classList.add("show");
      notice.classList.remove("editing");
      noticeTitle.textContent="Absensi sudah tersimpan";
      noticeText.textContent="Data dikunci untuk mencegah perubahan tidak sengaja. Klik Edit Absensi jika ada kesalahan input.";
      badge.textContent="TERSIMPAN";
      badge.classList.remove("editing");

      editBtn?.classList.remove("hidden");
      cancelBtn?.classList.add("hidden");

      saveBtn.style.display="none";
      saveBtn.textContent="Simpan Absensi";

      setFormDisabled(true);
      return;
    }

    if(editMode && hasSavedAttendance && canManage()){
      notice.classList.add("show","editing");
      noticeTitle.textContent="Mode Edit Absensi";
      noticeText.textContent="Perbaiki data yang salah, lalu klik Simpan Perubahan. Perubahan akan masuk ke riwayat audit.";
      badge.textContent="SEDANG DIEDIT";
      badge.classList.add("editing");

      editBtn?.classList.add("hidden");
      cancelBtn?.classList.remove("hidden");

      saveBtn.style.display="";
      saveBtn.textContent="Simpan Perubahan";
      saveBtn.disabled=false;

      setFormDisabled(false);
      return;
    }

    notice.classList.remove("show","editing");
    editBtn?.classList.add("hidden");
    cancelBtn?.classList.add("hidden");
    saveBtn.style.display="";
    if(saveBtn.textContent!=="Menyimpan...")saveBtn.textContent="Simpan Absensi";

    setFormDisabled(false);
  }

  function startEdit(){
    if(!canManage() || !hasSavedAttendance)return;

    editSnapshot=clone(rows);
    editContext={
      classId:selectedClass?.class_id||"",
      className:selectedClass?.class_name||"",
      date:document.getElementById("attendanceDate")?.value||""
    };
    editMode=true;

    try{renderAll()}catch(_){}
    applyUI();
  }

  function cancelEdit(){
    if(!editMode)return;
    if(!confirm("Batalkan perubahan dan kembalikan data seperti sebelum diedit?"))return;

    if(Array.isArray(editSnapshot)){
      rows.splice(0,rows.length,...clone(editSnapshot));
    }

    editMode=false;
    editSnapshot=null;
    editContext=null;
    pendingAudit=null;

    try{renderAll()}catch(_){}
    applyUI();
  }

  function leaveEditWithoutSave(){
    editMode=false;
    editSnapshot=null;
    editContext=null;
    pendingAudit=null;
  }

  function installRpcHook(){
    if(rpcHookInstalled)return true;
    if(!api?.db?.rpc)return false;

    rpcHookInstalled=true;
    const originalRpc=api.db.rpc.bind(api.db);

    api.db.rpc=async function(name,params={}){
      if(name!=="save_class_student_attendance"){
        return originalRpc(name,params);
      }

      try{
        const result=await originalRpc(name,params);

        const audit=pendingAudit;
        pendingAudit=null;

        if(audit?.changes?.length){
          try{
            await originalRpc("record_student_attendance_changes",{
              p_class_id:audit.classId,
              p_class_name:audit.className,
              p_date:audit.date,
              p_changes:audit.changes
            });
            showToast(`${audit.changes.length} perubahan siswa tercatat di riwayat.`);
          }catch(auditErr){
            console.warn("Riwayat perubahan gagal dicatat:",auditErr);
            showToast("Absensi berhasil disimpan, tetapi riwayat perubahan gagal dicatat.","warn");
          }
        }

        return result;
      }catch(err){
        pendingAudit=null;
        throw err;
      }
    };

    return true;
  }

  function install(){
    if(installed)return true;

    if(
      typeof loadAttendance!=="function" ||
      typeof renderAll!=="function" ||
      typeof rows==="undefined" ||
      typeof selectedClass==="undefined"
    ){
      return false;
    }

    installed=true;
    ensureUI();

    const rpcTimer=setInterval(()=>{
      if(installRpcHook())clearInterval(rpcTimer);
    },150);
    installRpcHook();

    const originalLoadAttendance=loadAttendance;
    loadAttendance=async function(...args){
      await originalLoadAttendance.apply(this,args);

      hasSavedAttendance=completeFromRows();
      leaveEditWithoutSave();

      setTimeout(applyUI,0);
    };

    const originalRenderTable=renderTable;
    renderTable=function(...args){
      const result=originalRenderTable.apply(this,args);
      setTimeout(applyUI,0);
      return result;
    };

    const saveBtn=document.getElementById("saveBtn");
    if(saveBtn){
      saveBtn.addEventListener("click",e=>{
        if(locked()){
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }

        if(editMode && hasSavedAttendance){
          const changes=buildChanges();

          if(!changes.length){
            alert("Tidak ada perubahan data absensi.");
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
          }

          const className=selectedClass?.class_name||"kelas ini";
          const date=document.getElementById("attendanceDate")?.value||"tanggal yang dipilih";
          const ok=confirm(
            `Simpan perubahan absensi ${className} tanggal ${date}?\n\n${changes.length} siswa mengalami perubahan. Riwayat perubahan akan dicatat.`
          );

          if(!ok){
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
          }

          pendingAudit={
            classId:selectedClass.class_id,
            className:selectedClass.class_name||"",
            date,
            changes
          };
        }
      },true);
    }

    const reloadBtn=document.getElementById("reloadBtn");
    reloadBtn?.addEventListener("click",e=>{
      if(editMode && !confirm("Ada perubahan yang belum disimpan. Muat ulang dan batalkan perubahan?")){
        e.preventDefault();
        e.stopImmediatePropagation();
      }else if(editMode){
        leaveEditWithoutSave();
      }
    },true);

    ["classFilter","attendanceDate"].forEach(id=>{
      const el=document.getElementById(id);
      el?.addEventListener("change",e=>{
        if(!editMode)return;

        const ok=confirm("Ada perubahan absensi yang belum disimpan. Tinggalkan mode edit?");
        if(!ok){
          e.preventDefault();
          e.stopImmediatePropagation();
          if(id==="classFilter")el.value=editContext?.classId||selectedClass?.class_id||"";
          if(id==="attendanceDate")el.value=editContext?.date||"";
          return;
        }
        leaveEditWithoutSave();
      },true);
    });

    document.addEventListener("click",e=>{
      const btn=e.target.closest?.("[data-today-class]");
      if(!btn || !editMode)return;

      const ok=confirm("Ada perubahan absensi yang belum disimpan. Pindah kelas dan batalkan perubahan?");
      if(!ok){
        e.preventDefault();
        e.stopImmediatePropagation();
      }else{
        leaveEditWithoutSave();
      }
    },true);

    window.addEventListener("beforeunload",e=>{
      if(!editMode)return;
      e.preventDefault();
      e.returnValue="";
    });

    const observer=new MutationObserver(()=>applyUI());
    const body=document.getElementById("attendanceBody");
    const cards=document.getElementById("attendanceCards");
    if(body)observer.observe(body,{childList:true,subtree:true});
    if(cards)observer.observe(cards,{childList:true,subtree:true});

    setTimeout(()=>{
      if(Array.isArray(rows) && rows.length){
        hasSavedAttendance=completeFromRows();
      }
      applyUI();
    },700);

    return true;
  }

  function boot(){
    if(install())return;
    setTimeout(boot,120);
  }

  boot();
})();