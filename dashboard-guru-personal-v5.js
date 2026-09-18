(function(){
  "use strict";

  const DASHBOARD_FILES = new Set(["dashboard.html","dashboard",""]);
  const currentFile = (location.pathname.split("/").pop() || "").toLowerCase();
  if(!DASHBOARD_FILES.has(currentFile)) return;

  const STYLE_ID = "simanis-dashboard-guru-personal-v5-style";
  const GENERAL_CLASS = "teacher-general-section-v5";
  const BODY_CLASS = "simanis-teacher-personal-v5";
  const BODY_GENERAL_OPEN = "simanis-teacher-general-open-v5";

  function injectStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.${BODY_CLASS} .dash-hero{
        margin-bottom:14px;
        border-radius:22px;
      }

      body.${BODY_CLASS} #teacherWorkspace{
        display:block !important;
      }

      .teacher-personal-head-v5{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:14px;
        margin:2px 0 10px;
      }

      .teacher-personal-head-v5 h3{
        margin:0;
        font-size:15px;
        color:#063d2c;
      }

      .teacher-personal-head-v5 p{
        margin:4px 0 0;
        color:#718078;
        font-size:8.5px;
        line-height:1.5;
      }

      .teacher-personal-head-v5 .teacher-personal-label-v5{
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:6px 9px;
        border-radius:999px;
        background:#e8f5ee;
        color:#0b7347;
        font-size:7px;
        font-weight:900;
        white-space:nowrap;
      }

      .teacher-today-focus-v5{
        display:grid;
        grid-template-columns:minmax(0,1fr);
        gap:12px;
        margin-bottom:14px;
      }

      .teacher-today-focus-v5 > .dash-card{
        margin:0 !important;
        border-color:#b8d8c8;
        box-shadow:0 10px 24px rgba(7,91,58,.08);
      }

      body.${BODY_CLASS} .teacher-overview{
        grid-template-columns:repeat(6,minmax(0,1fr));
      }

      body.${BODY_CLASS} .teacher-stat{
        min-height:90px;
      }

      body.${BODY_CLASS} .teacher-quick{
        margin-top:2px;
      }

      .teacher-general-toggle-wrap-v5{
        display:flex;
        justify-content:center;
        margin:4px 0 14px;
      }

      .teacher-general-toggle-v5{
        border:1px solid #d8e6df;
        background:#fff;
        color:#075b3a;
        border-radius:999px;
        padding:9px 14px;
        font-size:8.5px;
        font-weight:900;
        cursor:pointer;
        box-shadow:0 5px 14px rgba(7,91,58,.05);
      }

      body.${BODY_CLASS} .${GENERAL_CLASS}{
        display:none !important;
      }

      body.${BODY_CLASS}.${BODY_GENERAL_OPEN} .${GENERAL_CLASS}{
        display:grid !important;
      }

      body.${BODY_CLASS}.${BODY_GENERAL_OPEN} #madrasahSnapshotTitle.${GENERAL_CLASS}{
        display:flex !important;
      }

      body.${BODY_CLASS}.${BODY_GENERAL_OPEN} .dash-card.${GENERAL_CLASS}{
        display:block !important;
      }

      body.${BODY_CLASS}.${BODY_GENERAL_OPEN} section.${GENERAL_CLASS}.dash-stats{
        display:grid !important;
      }

      body.${BODY_CLASS}.${BODY_GENERAL_OPEN} section.${GENERAL_CLASS}.dash-grid{
        display:grid !important;
      }

      @media(max-width:1100px){
        body.${BODY_CLASS} .teacher-overview{
          grid-template-columns:repeat(3,1fr);
        }
      }

      @media(max-width:760px){
        body.${BODY_CLASS} .dash-hero{
          padding:20px !important;
        }

        body.${BODY_CLASS} .dash-hero h2{
          font-size:24px !important;
        }

        body.${BODY_CLASS} .teacher-overview{
          grid-template-columns:repeat(2,1fr) !important;
          gap:9px;
        }

        body.${BODY_CLASS} .teacher-quick{
          grid-template-columns:repeat(2,1fr) !important;
        }

        body.${BODY_CLASS} .teacher-operational-grid,
        body.${BODY_CLASS} .teacher-task-grid{
          grid-template-columns:1fr !important;
        }

        body.${BODY_CLASS} .teacher-context-grid,
        body.${BODY_CLASS} .jobdesk-grid-dashboard{
          grid-template-columns:1fr !important;
        }

        .teacher-personal-head-v5{
          align-items:flex-start;
          flex-direction:column;
        }

        .teacher-today-focus-v5 .item{
          display:grid;
          grid-template-columns:30px 56px minmax(0,1fr);
        }

        .teacher-today-focus-v5 .task-state{
          grid-column:3;
          justify-self:start;
          margin-top:4px;
        }
      }

      @media(max-width:430px){
        body.${BODY_CLASS} .teacher-overview{
          grid-template-columns:1fr 1fr !important;
        }

        body.${BODY_CLASS} .teacher-quick{
          grid-template-columns:1fr !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function markGeneralSection(el){
    if(el) el.classList.add(GENERAL_CLASS);
  }

  function buildHeader(workspace){
    if(document.getElementById("teacherPersonalHeadV5")) return;
    const head = document.createElement("div");
    head.id = "teacherPersonalHeadV5";
    head.className = "teacher-personal-head-v5";
    head.innerHTML = `
      <div>
        <h3>Dashboard Saya</h3>
        <p>Jadwal mengajar, absensi, nilai, wali kelas, dan jobdesk pribadi.</p>
      </div>
      <span class="teacher-personal-label-v5">MODE GURU PERSONAL</span>
    `;
    workspace.insertBefore(head,workspace.firstChild);
  }

  function moveTodayScheduleIntoWorkspace(workspace){
    if(document.getElementById("teacherTodayFocusV5")) return;

    const scheduleList = document.getElementById("todaySchedule");
    const quick = document.getElementById("teacherQuickActions");
    if(!scheduleList || !quick) return;

    const scheduleCard = scheduleList.closest("article.dash-card");
    if(!scheduleCard) return;

    const focus = document.createElement("section");
    focus.id = "teacherTodayFocusV5";
    focus.className = "teacher-today-focus-v5";

    const title = scheduleCard.querySelector(".dash-title h3");
    if(title) title.textContent = "Jadwal Mengajar Hari Ini";

    const quickParent = quick;
    quickParent.insertAdjacentElement("afterend",focus);
    focus.appendChild(scheduleCard);
  }

  function markGeneralBlocks(){
    const snapshotTitle = document.getElementById("madrasahSnapshotTitle");
    markGeneralSection(snapshotTitle);

    if(snapshotTitle){
      const next = snapshotTitle.nextElementSibling;
      if(next?.classList.contains("dash-stats")) markGeneralSection(next);
    }

    const quickGrid = document.getElementById("quickGrid");
    markGeneralSection(quickGrid?.closest("section.dash-card"));

    const attendanceChart = document.getElementById("attendanceChart");
    const chartGrid = attendanceChart?.closest("section.dash-grid");
    if(chartGrid){
      const scheduleCard = document.getElementById("todaySchedule")?.closest("article.dash-card");
      if(scheduleCard && scheduleCard.parentElement === chartGrid){
        // schedule is moved separately; hide the leftover general attendance chart grid.
        markGeneralSection(chartGrid);
      }else{
        markGeneralSection(chartGrid);
      }
    }

    markGeneralSection(document.getElementById("agendaList")?.closest("section.dash-grid"));
    markGeneralSection(document.getElementById("financeSection"));
    markGeneralSection(document.getElementById("achievementList")?.closest("section.dash-grid"));
  }

  function buildGeneralToggle(workspace){
    if(document.getElementById("teacherGeneralToggleV5")) return;

    const wrap = document.createElement("div");
    wrap.className = "teacher-general-toggle-wrap-v5";

    const btn = document.createElement("button");
    btn.id = "teacherGeneralToggleV5";
    btn.className = "teacher-general-toggle-v5";
    btn.type = "button";
    btn.textContent = "Tampilkan Informasi Umum Madrasah";
    btn.setAttribute("aria-expanded","false");

    btn.addEventListener("click",()=>{
      const open = document.body.classList.toggle(BODY_GENERAL_OPEN);
      btn.textContent = open
        ? "Sembunyikan Informasi Umum Madrasah"
        : "Tampilkan Informasi Umum Madrasah";
      btn.setAttribute("aria-expanded",String(open));
    });

    wrap.appendChild(btn);
    workspace.insertAdjacentElement("afterend",wrap);
  }

  function applyTeacherDashboard(){
    const workspace = document.getElementById("teacherWorkspace");
    if(!workspace || !workspace.classList.contains("show")) return false;

    if(document.body.classList.contains(BODY_CLASS)) return true;

    injectStyles();
    document.body.classList.add(BODY_CLASS);

    const welcome = document.getElementById("welcomeText");
    if(welcome){
      welcome.textContent = "Jadwal mengajar, tugas kelas, absensi, nilai, wali kelas, dan jobdesk Anda hari ini.";
    }

    buildHeader(workspace);
    moveTodayScheduleIntoWorkspace(workspace);
    markGeneralBlocks();
    buildGeneralToggle(workspace);

    return true;
  }

  function watch(){
    if(applyTeacherDashboard()) return;

    const target = document.getElementById("teacherWorkspace") || document.body;
    const observer = new MutationObserver(()=>{
      if(applyTeacherDashboard()) observer.disconnect();
    });

    observer.observe(target,{
      attributes:true,
      attributeFilter:["class"],
      childList:true,
      subtree:true
    });

    // Fallback for slow network/data load.
    let tries = 0;
    const timer = setInterval(()=>{
      tries++;
      if(applyTeacherDashboard() || tries > 80){
        clearInterval(timer);
        observer.disconnect();
      }
    },250);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",watch,{once:true});
  }else{
    watch();
  }
})();
