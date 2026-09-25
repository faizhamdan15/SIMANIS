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
  let deepLinkApplied=false;
  let recapRows=[];

  const COMPLETE_STATUSES=new Set(["HADIR","TERLAMBAT","IZIN","SAKIT","ALFA"]);
  const AUDIT_FIELDS=["attendance_status","arrival_time","late_minutes","note"];

  function clone(v){
    try{return structuredClone(v)}
    catch(_){return JSON.parse(JSON.stringify(v))}
  }

  function esc(s){
    return String(s??"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
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

  function localDate(){
    if(typeof localISODate==="function")return localISODate();
    const p=new Intl.DateTimeFormat("en-CA",{
      timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"
    }).formatToParts(new Date());
    const o={};p.forEach(x=>o[x.type]=x.value);
    return `${o.year}-${o.month}-${o.day}`;
  }

  function addDays(iso,delta){
    const d=new Date(`${iso}T12:00:00+07:00`);
    d.setUTCDate(d.getUTCDate()+delta);
    return new Intl.DateTimeFormat("en-CA",{
      timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"
    }).format(d);
  }

  function fmtDate(iso){
    if(!iso)return"-";
    try{
      return new Intl.DateTimeFormat("id-ID",{
        timeZone:"Asia/Jakarta",weekday:"short",day:"2-digit",month:"short",year:"numeric"
      }).format(new Date(`${iso}T12:00:00+07:00`));
    }catch{return iso}
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

  function subjectNamesFor(classId,date){
    try{
      if(!Array.isArray(personalSchedule))return "";
      const day=typeof dayNameFromISO==="function"?dayNameFromISO(date):"";
      return [...new Set(
        personalSchedule
          .filter(x=>String(x.class_id)===String(classId) && (!day || x.day_of_week===day))
          .map(x=>x.subject_name)
          .filter(Boolean)
      )].join(", ");
    }catch{return ""}
  }

  function buildArchiveItems(savedItems){
    const source=Array.isArray(savedItems)?savedItems:[];
    const rowMap=new Map((rows||[]).map(r=>[String(r.enrollment_id),r]));

    return source.map(x=>{
      const r=rowMap.get(String(x.enrollment_id))||{};
      return {
        enrollment_id:x.enrollment_id,
        student_name:r.full_name||"",
        nis:r.nis||"",
        nisn:r.nisn||"",
        roll_number:r.roll_number??null,
        status:x.status||r.attendance_status||"BELUM_DIABSEN",
        arrival_time:x.arrival_time||null,
        late_minutes:Number(x.late_minutes||0),
        note:x.note||null
      };
    });
  }

  function showToast(message,type="ok"){
    let box=document.getElementById("studentAttendanceAuditToast");
    if(!box){
      box=document.createElement("div");
      box.id="studentAttendanceAuditToast";
      box.style.cssText=[
        "position:fixed","right:18px","bottom:18px","z-index:99999",
        "max-width:380px","padding:12px 14px","border-radius:12px",
        "font:700 10px Inter,Arial,sans-serif","box-shadow:0 14px 35px rgba(0,0,0,.18)",
        "transition:.2s"
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
    const qs=new URLSearchParams();
    if(d)qs.set("date",d);
    if(c)qs.set("class",c);
    return "absensi-siswa-riwayat.html"+(qs.toString()?`?${qs.toString()}`:"");
  }

  function recapUrl(){
    const qs=new URLSearchParams();
    if(selectedClass?.class_id)qs.set("class",selectedClass.class_id);
    return "absensi-siswa-rekap.html"+(qs.toString()?`?${qs.toString()}`:"");
  }

  function editRecapUrl(r){
    const qs=new URLSearchParams({
      date:r.attendance_date,
      class:r.class_id,
      recap:String(r.id),
      edit:"1"
    });
    return `absensi-siswa.html?${qs.toString()}`;
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
      .sa-edit-tools .recap{background:#eef8f2;color:#075b3a;border-color:#cfe4d8}
      .sa-edit-tools button.hidden{display:none}
      .sa-locked-field{background:#f5f7f6!important;color:#6b746f!important;cursor:not-allowed!important}

      .teacher-recap-panel{display:none;background:#fff;border:1px solid #dfe9e4;border-radius:18px;padding:14px;margin-bottom:14px}
      .teacher-recap-panel.show{display:block}
      .teacher-recap-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}
      .teacher-recap-head h3{margin:0;font-size:13px;color:#075b3a}
      .teacher-recap-head p{margin:4px 0 0;font-size:8.5px;color:#718078}
      .teacher-recap-all{border:1px solid #d7e2dc;background:#fff;color:#075b3a;border-radius:9px;padding:8px 10px;font-size:9px;font-weight:800;cursor:pointer}
      .teacher-recap-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .teacher-recap-card{border:1px solid #e2eae6;background:#fbfdfc;border-radius:13px;padding:11px}
      .teacher-recap-card h4{margin:0;font-size:11px;color:#173f30}
      .teacher-recap-card .meta{margin-top:3px;font-size:8px;color:#718078}
      .teacher-recap-counts{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
      .teacher-recap-counts span{padding:4px 6px;border-radius:999px;background:#eff5f1;font-size:7.5px;font-weight:800;color:#42594d}
      .teacher-recap-actions{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap}
      .teacher-recap-actions button{border:1px solid #d7e2dc;background:#fff;color:#075b3a;border-radius:8px;padding:7px 8px;font-size:8px;font-weight:800;cursor:pointer}
      .teacher-recap-actions button.primary{background:#075b3a;color:#fff;border-color:#075b3a}
      .teacher-recap-empty{font-size:9px;color:#718078;padding:8px 0}
      @media(max-width:850px){.teacher-recap-list{grid-template-columns:1fr}}
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
        <button type="button" id="attendanceRecapBtn" class="recap">Rekap Absensi Saya</button>
        <button type="button" id="attendanceHistoryBtn" class="history">Riwayat Perubahan</button>
        <button type="button" id="cancelAttendanceEditBtn" class="cancel hidden">Batalkan Edit</button>
        <button type="button" id="editAttendanceBtn" class="edit hidden">Edit Absensi</button>
      `;
      saveBar.appendChild(tools);

      document.getElementById("editAttendanceBtn").addEventListener("click",startEdit);
      document.getElementById("cancelAttendanceEditBtn").addEventListener("click",cancelEdit);
      document.getElementById("attendanceHistoryBtn").addEventListener("click",()=>location.href=historyUrl());
      document.getElementById("attendanceRecapBtn").addEventListener("click",()=>location.href=recapUrl());
    }

    const hint=document.getElementById("teacherHint");
    if(hint && !document.getElementById("myTeacherRecapPanel")){
      const panel=document.createElement("section");
      panel.id="myTeacherRecapPanel";
      panel.className="teacher-recap-panel";
      panel.innerHTML=`
        <div class="teacher-recap-head">
          <div>
            <h3>Rekap Absensi Saya</h3>
            <p>Rekap kelas yang pernah Anda absen. Tetap dapat dibuka, diedit di hari berikutnya, dan diunduh meski bukan wali kelas.</p>
          </div>
          <button type="button" id="openAllTeacherRecap" class="teacher-recap-all">Lihat Semua Rekap</button>
        </div>
        <div id="teacherRecapList" class="teacher-recap-list">
          <div class="teacher-recap-empty">Memuat rekap...</div>
        </div>
      `;
      hint.insertAdjacentElement("afterend",panel);
      document.getElementById("openAllTeacherRecap").onclick=()=>location.href=recapUrl();
    }
  }

  function isTeacherAccount(){
    try{
      return ["GURU","WALI_KELAS"].includes(String(profile?.role||"").toUpperCase());
    }catch{return false}
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
    const recapBtn=document.getElementById("attendanceRecapBtn");
    const recapPanel=document.getElementById("myTeacherRecapPanel");
    const saveBtn=document.getElementById("saveBtn");

    if(recapPanel)recapPanel.classList.toggle("show",isTeacherAccount());
    if(recapBtn)recapBtn.style.display=isTeacherAccount()?"":"none";
    if(historyBtn)historyBtn.style.display=selectedClass?"":"none";

    if(!notice || !saveBtn)return;

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
      noticeText.textContent="Perbaiki data, lalu klik Simpan Perubahan. Rekap guru dan riwayat perubahan akan diperbarui.";
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

  async function downloadRecap(recap){
    try{
      const detail=await api.db.rpc("get_my_student_attendance_recap_detail",{
        p_recap_id:Number(recap.id)
      })||[];

      if(!detail.length){
        alert("Detail rekap tidak ditemukan.");
        return;
      }

      const csvCell=v=>`"${String(v??"").replaceAll('"','""')}"`;
      const lines=[
        ["Tanggal","Kelas","Mata Pelajaran","No","Nama Siswa","NIS","NISN","Status","Jam Datang","Terlambat (menit)","Catatan"],
        ...detail.map(r=>[
          recap.attendance_date,
          recap.class_name,
          recap.subject_names||"",
          r.roll_number??"",
          r.student_name||"",
          r.nis||"",
          r.nisn||"",
          r.attendance_status||"",
          r.arrival_time?String(r.arrival_time).slice(0,5):"",
          Number(r.late_minutes||0),
          r.note||""
        ])
      ];

      const text="\uFEFFsep=;\r\n"+lines.map(row=>row.map(csvCell).join(";")).join("\r\n");
      const blob=new Blob([text],{type:"text/csv;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;
      a.download=`Rekap_Absensi_${String(recap.class_name||"Kelas").replace(/[^\p{L}\p{N}]+/gu,"_")}_${recap.attendance_date}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),500);
    }catch(err){
      alert("Gagal mengunduh rekap: "+(err.message||err));
    }
  }

  function renderRecapPanel(){
    const box=document.getElementById("teacherRecapList");
    if(!box || !isTeacherAccount())return;

    if(!recapRows.length){
      box.innerHTML='<div class="teacher-recap-empty">Belum ada rekap tersimpan. Rekap akan dibuat otomatis setelah Anda menyimpan absensi kelas.</div>';
      return;
    }

    box.innerHTML=recapRows.slice(0,6).map(r=>`
      <article class="teacher-recap-card">
        <h4>${esc(r.class_name||"Kelas")}</h4>
        <div class="meta">${esc(fmtDate(r.attendance_date))}${r.subject_names?` · ${esc(r.subject_names)}`:""} · revisi ${Number(r.revision_no||1)}</div>
        <div class="teacher-recap-counts">
          <span>H ${Number(r.present_count||0)}</span>
          <span>T ${Number(r.late_count||0)}</span>
          <span>I ${Number(r.permit_count||0)}</span>
          <span>S ${Number(r.sick_count||0)}</span>
          <span>A ${Number(r.absent_count||0)}</span>
        </div>
        <div class="teacher-recap-actions">
          ${r.can_edit?`<button class="primary" type="button" data-recap-edit="${r.id}">Buka / Edit</button>`:""}
          <button type="button" data-recap-download="${r.id}">Download CSV</button>
        </div>
      </article>
    `).join("");

    box.querySelectorAll("[data-recap-edit]").forEach(btn=>{
      btn.onclick=()=>{
        const r=recapRows.find(x=>String(x.id)===String(btn.dataset.recapEdit));
        if(r)location.href=editRecapUrl(r);
      };
    });

    box.querySelectorAll("[data-recap-download]").forEach(btn=>{
      btn.onclick=()=>{
        const r=recapRows.find(x=>String(x.id)===String(btn.dataset.recapDownload));
        if(r)downloadRecap(r);
      };
    });
  }

  async function refreshRecapPanel(){
    if(!isTeacherAccount() || !api?.db?.rpc)return;
    const box=document.getElementById("teacherRecapList");
    if(box)box.innerHTML='<div class="teacher-recap-empty">Memuat rekap...</div>';

    try{
      const end=localDate();
      const start=addDays(end,-45);
      recapRows=await api.db.rpc("list_my_student_attendance_recaps",{
        p_date_from:start,
        p_date_to:end,
        p_limit:50
      })||[];
      renderRecapPanel();
    }catch(err){
      console.warn("Rekap Absensi Saya belum tersedia:",err);
      if(box){
        box.innerHTML='<div class="teacher-recap-empty">Rekap guru belum aktif. Jalankan SQL Rekap Guru V3 di Supabase.</div>';
      }
    }
  }

  async function backfillOnce(){
    if(!isTeacherAccount() || !api?.db?.rpc)return;
    const uid=profile?.id||"me";
    const key=`simanis-teacher-recap-backfill-v3-${uid}`;
    if(localStorage.getItem(key)==="1")return;

    try{
      await api.db.rpc("backfill_my_student_attendance_recaps",{p_days:120});
      localStorage.setItem(key,"1");
    }catch(err){
      console.warn("Backfill rekap lama belum dapat dijalankan:",err);
    }
  }

  async function overlayRecapSnapshot(recapId){
    const detail=await api.db.rpc("get_my_student_attendance_recap_detail",{
      p_recap_id:Number(recapId)
    })||[];

    if(!detail.length)return false;

    const map=new Map(detail.map(x=>[String(x.enrollment_id),x]));

    rows.forEach(r=>{
      const x=map.get(String(r.enrollment_id));
      if(!x)return;
      r.attendance_status=x.attendance_status||"BELUM_DIABSEN";
      r.arrival_time=x.arrival_time?String(x.arrival_time).slice(0,5):null;
      r.late_minutes=Number(x.late_minutes||0);
      r.note=x.note||null;
    });

    hasSavedAttendance=completeFromRows();
    renderAll();
    return true;
  }

  async function applyDeepLink(){
    if(deepLinkApplied || !Array.isArray(classes) || !classes.length)return;
    const q=new URLSearchParams(location.search);
    const date=q.get("date");
    const classId=q.get("class");
    const recapId=q.get("recap");
    const wantsEdit=q.get("edit")==="1";

    if(!date && !classId && !recapId)return;

    deepLinkApplied=true;

    try{
      if(date)document.getElementById("attendanceDate").value=date;

      if(classId && classes.some(c=>String(c.class_id)===String(classId))){
        document.getElementById("classFilter").value=classId;
        await chooseClass(classId);
      }else if(classId){
        showToast("Kelas rekap ini tidak lagi berada dalam hak kelola akun Anda.","warn");
        return;
      }

      if(recapId){
        await overlayRecapSnapshot(recapId);
      }

      if(wantsEdit && canManage() && hasSavedAttendance){
        startEdit();
        showToast("Rekap lama dibuka dalam Mode Edit.");
      }
    }catch(err){
      console.error("Deep link rekap gagal:",err);
      showToast("Rekap lama gagal dibuka: "+(err.message||err),"warn");
    }
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

      const archivePayload=(
        isTeacherAccount() &&
        selectedClass?.class_id &&
        document.getElementById("attendanceDate")?.value
      ) ? {
        classId:selectedClass.class_id,
        className:selectedClass.class_name||"",
        date:document.getElementById("attendanceDate").value,
        subjectNames:subjectNamesFor(
          selectedClass.class_id,
          document.getElementById("attendanceDate").value
        ),
        items:buildArchiveItems(params?.p_items||[])
      } : null;

      try{
        const result=await originalRpc(name,params);

        if(archivePayload?.items?.length){
          try{
            await originalRpc("archive_my_student_attendance_recap",{
              p_class_id:archivePayload.classId,
              p_class_name:archivePayload.className,
              p_date:archivePayload.date,
              p_subject_names:archivePayload.subjectNames||null,
              p_items:archivePayload.items
            });
            showToast("Rekap Absensi Saya diperbarui.");
            setTimeout(refreshRecapPanel,250);
          }catch(recapErr){
            console.warn("Rekap guru gagal disimpan:",recapErr);
            showToast("Absensi berhasil disimpan, tetapi rekap guru gagal diperbarui.","warn");
          }
        }

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
            `Simpan perubahan absensi ${className} tanggal ${date}?\n\n${changes.length} siswa mengalami perubahan. Rekap guru dan riwayat perubahan akan diperbarui.`
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

    setTimeout(async()=>{
      if(Array.isArray(rows) && rows.length){
        hasSavedAttendance=completeFromRows();
      }
      applyUI();

      if(isTeacherAccount()){
        await backfillOnce();
        await refreshRecapPanel();
        await applyDeepLink();
      }
    },900);

    // Kelas kadang selesai dimuat setelah addon lebih dahulu.
    const deepTimer=setInterval(async()=>{
      if(deepLinkApplied){
        clearInterval(deepTimer);
        return;
      }
      if(Array.isArray(classes)&&classes.length){
        await applyDeepLink();
        if(deepLinkApplied)clearInterval(deepTimer);
      }
    },350);

    return true;
  }

  function boot(){
    if(install())return;
    setTimeout(boot,120);
  }

  boot();
})();