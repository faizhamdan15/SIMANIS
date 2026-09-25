(function(){
  const page=(location.pathname.split("/").pop()||"").toLowerCase();
  if(page!=="absensi-siswa.html")return;

  let installed=false;
  let applying=false;
  let editMode=false;
  let editSnapshot=null;
  let editContext=null;
  let hasSavedAttendance=false;
  let pendingAudit=null;
  let rpcHookInstalled=false;

  let subjectRows=[];
  let selectedSubject=null;
  let subjectLoadKey="";

  const COMPLETE_STATUSES=new Set(["HADIR","TERLAMBAT","IZIN","SAKIT","ALFA"]);
  const AUDIT_FIELDS=["attendance_status","arrival_time","late_minutes","note"];

  function clone(v){
    try{return structuredClone(v)}
    catch(_){return JSON.parse(JSON.stringify(v))}
  }

  function esc2(s){
    return String(s??"")
      .replaceAll("&","&amp;").replaceAll("<","&lt;")
      .replaceAll(">","&gt;").replaceAll('"',"&quot;");
  }

  function localISO(){
    const p=new Intl.DateTimeFormat("en-CA",{
      timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"
    }).formatToParts(new Date());
    const o={};p.forEach(x=>o[x.type]=x.value);
    return `${o.year}-${o.month}-${o.day}`;
  }

  function completeFromRows(){
    return Array.isArray(rows)
      && rows.length>0
      && rows.every(r=>COMPLETE_STATUSES.has(String(r.attendance_status||"")));
  }

  function anyRecorded(){
    return Array.isArray(rows)
      && rows.some(r=>String(r.attendance_status||"")!=="BELUM_DIABSEN");
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
        before,after
      });
    });
    return changes;
  }

  function showToast(message,type="ok"){
    let box=document.getElementById("studentAttendanceAuditToast");
    if(!box){
      box=document.createElement("div");
      box.id="studentAttendanceAuditToast";
      box.style.cssText=[
        "position:fixed","right:18px","bottom:18px","z-index:99999",
        "max-width:370px","padding:12px 14px","border-radius:12px",
        "font:700 10px Inter,Arial,sans-serif",
        "box-shadow:0 14px 35px rgba(0,0,0,.18)","transition:.2s"
      ].join(";");
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
    const s=selectedSubject?.subject_id||"";
    const qs=new URLSearchParams();
    if(d)qs.set("date",d);
    if(c)qs.set("class",c);
    if(s)qs.set("subject",s);
    return "absensi-siswa-riwayat.html"+(qs.toString()?`?${qs.toString()}`:"");
  }

  function ensureUI(){
    const toolbar=document.querySelector(".student-att-toolbar");
    if(toolbar && !document.getElementById("subjectFilter")){
      const select=document.createElement("select");
      select.id="subjectFilter";
      select.innerHTML='<option value="">Pilih Mata Pelajaran...</option>';
      const classFilter=document.getElementById("classFilter");
      classFilter?.insertAdjacentElement("afterend",select);

      select.addEventListener("change",async()=>{
        if(editMode){
          const ok=confirm("Ada perubahan yang belum disimpan. Ganti mata pelajaran dan batalkan perubahan?");
          if(!ok){
            select.value=selectedSubject?.subject_id||"";
            return;
          }
          leaveEditWithoutSave();
        }
        selectedSubject=subjectRows.find(x=>String(x.subject_id)===String(select.value))||null;
        await loadAttendance();
        try{await refreshTodayProgress();renderTodayClasses()}catch(_){}
      });
    }

    if(!document.getElementById("studentAttendanceMapelStyle")){
      const style=document.createElement("style");
      style.id="studentAttendanceMapelStyle";
      style.textContent=`
        .student-att-toolbar{grid-template-columns:.72fr .9fr 1.05fr 1.15fr .7fr!important}
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
        .sa-edit-tools .delete{color:#a52d22;border-color:#efc2bd;background:#fff8f7}
        .sa-edit-tools button.hidden{display:none}
        .sa-locked-field{background:#f5f7f6!important;color:#6b746f!important;cursor:not-allowed!important}
        .sa-subject-chip{display:inline-flex;margin-top:5px;padding:5px 8px;border-radius:999px;background:#e8f5ee;color:#08743f;font-size:8px;font-weight:800}
        @media(max-width:850px){.student-att-toolbar{grid-template-columns:1fr 1fr!important}}
        @media(max-width:520px){.student-att-toolbar{grid-template-columns:1fr!important}}
      `;
      document.head.appendChild(style);
    }

    const quick=document.querySelector(".quick-actions");
    if(quick && !document.getElementById("studentAttendanceSavedNotice")){
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
    if(saveBar && !document.getElementById("studentAttendanceEditTools")){
      const tools=document.createElement("div");
      tools.id="studentAttendanceEditTools";
      tools.className="sa-edit-tools";
      tools.innerHTML=`
        <button type="button" id="attendanceHistoryBtn" class="history">Riwayat Perubahan</button>
        <button type="button" id="deleteTodayAttendanceBtn" class="delete hidden">Hapus Absensi Hari Ini</button>
        <button type="button" id="cancelAttendanceEditBtn" class="cancel hidden">Batalkan Edit</button>
        <button type="button" id="editAttendanceBtn" class="edit hidden">Edit Absensi</button>
      `;
      saveBar.appendChild(tools);

      document.getElementById("attendanceHistoryBtn").onclick=()=>location.href=historyUrl();
      document.getElementById("editAttendanceBtn").onclick=startEdit;
      document.getElementById("cancelAttendanceEditBtn").onclick=cancelEdit;
      document.getElementById("deleteTodayAttendanceBtn").onclick=deleteTodayAttendance;
    }
  }

  async function loadSubjects(force=false){
    ensureUI();
    const select=document.getElementById("subjectFilter");
    if(!selectedClass){
      subjectRows=[];selectedSubject=null;subjectLoadKey="";
      if(select)select.innerHTML='<option value="">Pilih Mata Pelajaran...</option>';
      return;
    }

    const date=document.getElementById("attendanceDate")?.value||localISO();
    const key=`${selectedClass.class_id}|${date}`;
    if(!force && subjectLoadKey===key && subjectRows.length){
      return;
    }

    subjectLoadKey=key;
    const previous=selectedSubject?.subject_id||select?.value||"";

    try{
      subjectRows=await api.db.rpc("get_my_attendance_subjects",{
        p_class_id:selectedClass.class_id,
        p_date:date
      })||[];
    }catch(err){
      console.error("Mata pelajaran absensi gagal dimuat:",err);
      subjectRows=[];
    }

    if(select){
      select.innerHTML='<option value="">Pilih Mata Pelajaran...</option>'+
        subjectRows.map(s=>{
          const extra=s.slot_codes?` · ${s.slot_codes}`:"";
          return `<option value="${esc2(s.subject_id)}">${esc2(s.subject_name||s.subject_code||"Mapel")}${esc2(extra)}</option>`;
        }).join("");
    }

    selectedSubject=
      subjectRows.find(x=>String(x.subject_id)===String(previous))
      || subjectRows[0]
      || null;

    if(select)select.value=selectedSubject?.subject_id||"";
  }

  async function subjectAwareLoadAttendance(){
    if(!selectedClass)return;

    const d=document.getElementById("attendanceDate").value;
    if(typeof setSaveMessage==="function")setSaveMessage("Memuat data absensi...","warn");

    await loadSubjects();

    if(!selectedSubject){
      rows=[];
      hasSavedAttendance=false;
      try{renderAll()}catch(_){}
      if(typeof setSaveMessage==="function"){
        setSaveMessage("Tidak ada mata pelajaran terjadwal untuk kelas/tanggal ini.","warn");
      }
      applyUI();
      return;
    }

    rows=await api.db.rpc("get_class_subject_attendance_by_date",{
      p_class_id:selectedClass.class_id,
      p_subject_id:selectedSubject.subject_id,
      p_date:d
    })||[];

    hasSavedAttendance=completeFromRows();
    try{renderAll()}catch(_){}
    applyUI();
  }

  async function subjectAwareProgress(){
    todayProgress=new Map();
    if(!isTeacherMode)return;

    const groups=scheduleGroups();
    await Promise.all(groups.map(async g=>{
      const cls=classes.find(c=>c.class_id===g.class_id);
      if(!cls)return;

      const subjectIds=[...new Set(g.items.map(x=>x.subject_id).filter(Boolean))];

      try{
        if(!subjectIds.length){
          const data=await api.db.rpc("get_class_attendance_by_date",{
            p_class_id:g.class_id,p_date:document.getElementById("attendanceDate").value
          })||[];
          const marked=data.filter(r=>r.attendance_status&&r.attendance_status!=="BELUM_DIABSEN").length;
          todayProgress.set(g.class_id,{total:data.length,marked,complete:data.length>0&&marked>=data.length});
          return;
        }

        const sets=await Promise.all(subjectIds.map(subjectId=>
          api.db.rpc("get_class_subject_attendance_by_date",{
            p_class_id:g.class_id,
            p_subject_id:subjectId,
            p_date:document.getElementById("attendanceDate").value
          }).catch(()=>[])
        ));

        const total=sets.reduce((sum,data)=>sum+(data?.length||0),0);
        const marked=sets.reduce((sum,data)=>sum+(data||[]).filter(r=>r.attendance_status&&r.attendance_status!=="BELUM_DIABSEN").length,0);
        todayProgress.set(g.class_id,{total,marked,complete:total>0&&marked>=total});
      }catch(err){
        console.warn("Progress absensi mapel gagal dimuat:",g.class_name,err);
        todayProgress.set(g.class_id,{total:Number(cls.student_count||0),marked:0,complete:false});
      }
    }));
  }

  function decorateClassInfo(){
    const box=document.getElementById("classInfo");
    if(!box || !selectedClass || !selectedSubject)return;
    const left=box.firstElementChild;
    if(!left)return;

    let chip=left.querySelector(".sa-subject-chip");
    if(!chip){
      chip=document.createElement("span");
      chip.className="sa-subject-chip";
      left.appendChild(chip);
    }
    chip.textContent=`Mata Pelajaran: ${selectedSubject.subject_name||selectedSubject.subject_code||"-"}`;
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
        if(el)el.disabled=!canManage() || disabled || !selectedSubject;
      });
    }finally{applying=false}
  }

  function applyUI(){
    ensureUI();
    decorateClassInfo();

    const notice=document.getElementById("studentAttendanceSavedNotice");
    const title=document.getElementById("studentAttendanceSavedTitle");
    const note=document.getElementById("studentAttendanceSavedText");
    const badge=document.getElementById("studentAttendanceSavedBadge");
    const editBtn=document.getElementById("editAttendanceBtn");
    const cancelBtn=document.getElementById("cancelAttendanceEditBtn");
    const deleteBtn=document.getElementById("deleteTodayAttendanceBtn");
    const historyBtn=document.getElementById("attendanceHistoryBtn");
    const saveBtn=document.getElementById("saveBtn");

    if(!saveBtn)return;

    if(historyBtn)historyBtn.style.display=selectedClass?"":"none";

    const isToday=(document.getElementById("attendanceDate")?.value===localISO());
    const canDelete=!!(
      canManage() && selectedSubject && isToday && anyRecorded() && !editMode
    );

    if(deleteBtn){
      deleteBtn.classList.toggle("hidden",!canDelete);
    }

    if(locked()){
      notice?.classList.add("show");
      notice?.classList.remove("editing");
      if(title)title.textContent="Absensi sudah tersimpan";
      if(note)note.textContent=`${selectedSubject?.subject_name||"Mata pelajaran"} · data dikunci. Klik Edit Absensi jika ada kesalahan input.`;
      if(badge){badge.textContent="TERSIMPAN";badge.classList.remove("editing")}
      editBtn?.classList.remove("hidden");
      cancelBtn?.classList.add("hidden");
      saveBtn.style.display="none";
      saveBtn.textContent="Simpan Absensi";
      setFormDisabled(true);
      return;
    }

    if(editMode && hasSavedAttendance && canManage()){
      notice?.classList.add("show","editing");
      if(title)title.textContent="Mode Edit Absensi";
      if(note)note.textContent=`Perbaiki ${selectedSubject?.subject_name||"mata pelajaran ini"}, lalu klik Simpan Perubahan.`;
      if(badge){badge.textContent="SEDANG DIEDIT";badge.classList.add("editing")}
      editBtn?.classList.add("hidden");
      cancelBtn?.classList.remove("hidden");
      saveBtn.style.display="";
      saveBtn.textContent="Simpan Perubahan";
      saveBtn.disabled=false;
      setFormDisabled(false);
      return;
    }

    notice?.classList.remove("show","editing");
    editBtn?.classList.add("hidden");
    cancelBtn?.classList.add("hidden");
    saveBtn.style.display="";
    if(saveBtn.textContent!=="Menyimpan...")saveBtn.textContent="Simpan Absensi";
    setFormDisabled(false);
  }

  function startEdit(){
    if(!canManage() || !hasSavedAttendance || !selectedSubject)return;
    editSnapshot=clone(rows);
    editContext={
      classId:selectedClass?.class_id||"",
      className:selectedClass?.class_name||"",
      subjectId:selectedSubject?.subject_id||"",
      subjectName:selectedSubject?.subject_name||"",
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
    leaveEditWithoutSave();
    try{renderAll()}catch(_){}
    applyUI();
  }

  function leaveEditWithoutSave(){
    editMode=false;
    editSnapshot=null;
    editContext=null;
    pendingAudit=null;
  }

  async function deleteTodayAttendance(){
    if(!canManage() || !selectedClass || !selectedSubject)return;

    const date=document.getElementById("attendanceDate")?.value||"";
    if(date!==localISO()){
      alert("Absensi hanya dapat dihapus pada hari yang sama.");
      return;
    }

    const className=selectedClass.class_name||"kelas ini";
    const subjectName=selectedSubject.subject_name||"mata pelajaran ini";

    const ok=confirm(
      `Hapus absensi ${subjectName} — ${className} hari ini?\n\n`+
      `Semua status siswa pada mata pelajaran ini akan kembali menjadi BELUM DIABSEN.\n`+
      `Tindakan ini dicatat di Riwayat Perubahan.`
    );
    if(!ok)return;

    const btn=document.getElementById("deleteTodayAttendanceBtn");
    if(btn){btn.disabled=true;btn.textContent="Menghapus..."}

    try{
      const count=await api.db.rpc("delete_class_subject_attendance_today",{
        p_class_id:selectedClass.class_id,
        p_subject_id:selectedSubject.subject_id,
        p_date:date
      });

      // Best effort sinkronisasi arsip Wali Kelas lama.
      // Bila implementasi archive mendukung snapshot kosong, arsip ikut bersih.
      try{
        await api.db.rpc("archive_teacher_class_attendance",{
          p_class_id:selectedClass.class_id,
          p_date:date,
          p_items:[]
        });
      }catch(err){
        console.warn("Arsip Wali Kelas tidak mendukung clear otomatis:",err);
      }

      await loadAttendance();
      try{await refreshTodayProgress();renderTodayClasses()}catch(_){}
      alert(`${Number(count||0)} data absensi ${subjectName} hari ini berhasil dihapus.`);
    }catch(err){
      alert("Gagal menghapus absensi: "+(err.message||err));
    }finally{
      if(btn){btn.disabled=false;btn.textContent="Hapus Absensi Hari Ini"}
      applyUI();
    }
  }

  function installRpcHook(){
    if(rpcHookInstalled || !api?.db?.rpc)return false;

    rpcHookInstalled=true;
    const originalRpc=api.db.rpc.bind(api.db);

    api.db.rpc=async function(name,params={}){
      if(name==="save_class_student_attendance" && selectedSubject?.subject_id){
        try{
          const result=await originalRpc("save_class_subject_student_attendance",{
            p_class_id:params.p_class_id,
            p_subject_id:selectedSubject.subject_id,
            p_date:params.p_date,
            p_items:params.p_items
          });

          const audit=pendingAudit;
          pendingAudit=null;

          if(audit?.changes?.length){
            try{
              await originalRpc("record_student_attendance_changes_v3",{
                p_class_id:audit.classId,
                p_class_name:audit.className,
                p_subject_id:audit.subjectId,
                p_subject_name:audit.subjectName,
                p_date:audit.date,
                p_changes:audit.changes,
                p_action_type:"UPDATE"
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
      }

      return originalRpc(name,params);
    };

    return true;
  }

  function install(){
    if(installed)return true;
    if(
      typeof loadAttendance!=="function" ||
      typeof refreshTodayProgress!=="function" ||
      typeof renderAll!=="function" ||
      typeof rows==="undefined" ||
      typeof selectedClass==="undefined"
    ) return false;

    installed=true;
    ensureUI();

    const rpcTimer=setInterval(()=>{
      if(installRpcHook())clearInterval(rpcTimer);
    },120);
    installRpcHook();

    // Ganti loader absensi menjadi per mata pelajaran.
    loadAttendance=subjectAwareLoadAttendance;

    // Progress "Kelas Saya Hari Ini" dihitung per mapel.
    refreshTodayProgress=subjectAwareProgress;

    const originalRenderClassInfo=renderClassInfo;
    renderClassInfo=function(...args){
      const result=originalRenderClassInfo.apply(this,args);
      decorateClassInfo();
      return result;
    };

    const originalRenderTable=renderTable;
    renderTable=function(...args){
      const result=originalRenderTable.apply(this,args);
      setTimeout(applyUI,0);
      return result;
    };

    const saveBtn=document.getElementById("saveBtn");
    saveBtn?.addEventListener("click",e=>{
      if(!selectedSubject){
        alert("Pilih mata pelajaran terlebih dahulu.");
        e.preventDefault();e.stopImmediatePropagation();
        return;
      }

      if(locked()){
        e.preventDefault();e.stopImmediatePropagation();
        return;
      }

      if(editMode && hasSavedAttendance){
        const changes=buildChanges();
        if(!changes.length){
          alert("Tidak ada perubahan data absensi.");
          e.preventDefault();e.stopImmediatePropagation();
          return;
        }

        const className=selectedClass?.class_name||"kelas ini";
        const subjectName=selectedSubject?.subject_name||"mata pelajaran";
        const date=document.getElementById("attendanceDate")?.value||"tanggal yang dipilih";

        const ok=confirm(
          `Simpan perubahan absensi ${subjectName} — ${className} tanggal ${date}?\n\n`+
          `${changes.length} siswa mengalami perubahan. Riwayat perubahan akan dicatat.`
        );

        if(!ok){
          e.preventDefault();e.stopImmediatePropagation();
          return;
        }

        pendingAudit={
          classId:selectedClass.class_id,
          className:selectedClass.class_name||"",
          subjectId:selectedSubject.subject_id,
          subjectName:selectedSubject.subject_name||"",
          date,changes
        };
      }
    },true);

    const reloadBtn=document.getElementById("reloadBtn");
    reloadBtn?.addEventListener("click",e=>{
      if(editMode && !confirm("Ada perubahan yang belum disimpan. Muat ulang dan batalkan perubahan?")){
        e.preventDefault();e.stopImmediatePropagation();
      }else if(editMode){
        leaveEditWithoutSave();
      }
    },true);

    ["classFilter","attendanceDate"].forEach(id=>{
      const el=document.getElementById(id);
      el?.addEventListener("change",e=>{
        subjectLoadKey="";
        if(!editMode)return;

        const ok=confirm("Ada perubahan absensi yang belum disimpan. Tinggalkan mode edit?");
        if(!ok){
          e.preventDefault();e.stopImmediatePropagation();
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
        e.preventDefault();e.stopImmediatePropagation();
      }else{
        leaveEditWithoutSave();
        subjectLoadKey="";
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

    setTimeout(async()=>{
      try{
        if(selectedClass){
          subjectLoadKey="";
          await loadAttendance();
          try{await refreshTodayProgress();renderTodayClasses()}catch(_){}
        }
      }catch(err){
        console.warn("Inisialisasi Absensi Mapel V3:",err);
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