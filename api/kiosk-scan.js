// =====================================================
// QR KIOSK ABSENSI GURU - MA NURUL ISLAM
//
// LOGIKA:
// 1. Verifikasi kiosk = ADMIN
// 2. Identifikasi guru dari QR
// 3. Cek hari libur khusus
// 4. Cek libur rutin mingguan
// 5. Cek hari wajib hadir guru
// 6. Absen masuk:
//      <= deadline  = HADIR
//      > deadline   = TERLAMBAT
// 7. Absen pulang mulai jam 12:30
// =====================================================

module.exports = async function handler(req, res) {

  if (req.method !== "POST") {

    return res.status(405).json({
      success: false,
      error: "Method tidak diizinkan"
    });

  }


  const SUPABASE_URL =
    process.env.SUPABASE_URL;

  const SUPABASE_PUBLIC_KEY =
    process.env.SUPABASE_PUBLISHABLE_KEY;

  const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;


  if (
    !SUPABASE_URL ||
    !SUPABASE_PUBLIC_KEY ||
    !SUPABASE_SERVICE_KEY
  ) {

    return res.status(500).json({
      success: false,
      error: "Konfigurasi server belum lengkap."
    });

  }


  try {

    // =================================================
    // 1. CEK SESSION KIOSK
    // =================================================

    const authHeader =
      req.headers.authorization || "";


    if (!authHeader.startsWith("Bearer ")) {

      return res.status(401).json({
        success: false,
        error: "Kiosk belum login."
      });

    }


    const accessToken =
      authHeader.substring(7);


    const userResponse =
      await fetch(
        `${SUPABASE_URL}/auth/v1/user`,
        {
          headers: {
            apikey: SUPABASE_PUBLIC_KEY,
            Authorization: `Bearer ${accessToken}`
          }
        }
      );


    if (!userResponse.ok) {

      return res.status(401).json({
        success: false,
        error: "Sesi kiosk tidak valid."
      });

    }


    const currentUser =
      await userResponse.json();


    // =================================================
    // 2. PASTIKAN ADMIN
    // =================================================

    const adminResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/profiles` +
        `?id=eq.${currentUser.id}` +
        `&select=id,full_name,role,active`,
        {
          headers: {
            apikey: SUPABASE_PUBLIC_KEY,
            Authorization: `Bearer ${accessToken}`
          }
        }
      );


    if (!adminResponse.ok) {

      return res.status(403).json({
        success: false,
        error: "Tidak dapat memeriksa hak akses kiosk."
      });

    }


    const adminData =
      await adminResponse.json();


    const admin =
      adminData[0];


    if (
      !admin ||
      admin.role !== "ADMIN" ||
      admin.active !== true
    ) {

      return res.status(403).json({
        success: false,
        error: "Kiosk hanya dapat digunakan oleh Admin."
      });

    }


    // =================================================
    // 3. TOKEN QR
    // =================================================

    const {
      qr_token
    } = req.body || {};


    if (
      !qr_token ||
      typeof qr_token !== "string" ||
      !qr_token.trim()
    ) {

      return res.status(400).json({
        success: false,
        error: "QR Code tidak terbaca."
      });

    }


    const cleanToken =
      qr_token.trim();


    // =================================================
    // 4. CARI GURU
    // =================================================

    const teacherResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/profiles` +
        `?qr_token=eq.${encodeURIComponent(cleanToken)}` +
        `&role=eq.GURU` +
        `&active=eq.true` +
        `&qr_enabled=eq.true` +
        `&select=id,full_name,nip,subject_name`,
        {
          headers:
            serviceHeaders(
              SUPABASE_SERVICE_KEY
            )
        }
      );


    if (!teacherResponse.ok) {

      return res.status(500).json({
        success: false,
        error: "Data guru tidak dapat dibaca."
      });

    }


    const teacherData =
      await teacherResponse.json();


    const teacher =
      teacherData[0];


    if (!teacher) {

      return res.status(404).json({
        success: false,
        error:
          "QR tidak terdaftar, dinonaktifkan, atau akun guru tidak aktif."
      });

    }


    // =================================================
    // 5. SETTING SEKOLAH
    // =================================================

    const settingsResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/school_settings` +
        `?id=eq.1` +
        `&select=school_name,timezone,default_check_in_deadline,check_out_start,late_tolerance_minutes`,
        {
          headers:
            serviceHeaders(
              SUPABASE_SERVICE_KEY
            )
        }
      );


    if (!settingsResponse.ok) {

      return res.status(500).json({
        success: false,
        error:
          "Pengaturan sekolah tidak dapat dibaca."
      });

    }


    const settingsData =
      await settingsResponse.json();


    const settings =
      settingsData[0];


    if (!settings) {

      return res.status(500).json({
        success: false,
        error:
          "Pengaturan sekolah belum tersedia."
      });

    }


    const timezone =
      settings.timezone ||
      "Asia/Jakarta";


    // =================================================
    // 6. WAKTU SEKARANG
    // =================================================

    const now =
      new Date();


    const local =
      getLocalDateTimeParts(
        now,
        timezone
      );


    const attendanceDate =
      `${local.year}-${local.month}-${local.day}`;


    const currentTime =
      `${local.hour}:${local.minute}:${local.second}`;


    const currentSeconds =
      timeToSeconds(
        currentTime
      );


    const dayOfWeek =
      getDayOfWeek(
        now,
        timezone
      );


    // =================================================
    // 7. CEK LIBUR TANGGAL KHUSUS
    // =================================================

    const specialHolidayResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/school_holidays` +
        `?holiday_date=eq.${attendanceDate}` +
        `&active=eq.true` +
        `&select=id,holiday_name` +
        `&limit=1`,
        {
          headers:
            serviceHeaders(
              SUPABASE_SERVICE_KEY
            )
        }
      );


    if (!specialHolidayResponse.ok) {

      return res.status(500).json({
        success: false,
        error:
          "Data hari libur tidak dapat diperiksa."
      });

    }


    const specialHolidayData =
      await specialHolidayResponse.json();


    const specialHoliday =
      specialHolidayData[0];


    if (specialHoliday) {

      return res.status(409).json({

        success: false,

        type: "HOLIDAY",

        teacher: {
          id: teacher.id,
          full_name: teacher.full_name,
          nip: teacher.nip || "",
          subject_name: teacher.subject_name || ""
        },

        holiday: {
          type: "SPECIAL",
          name: specialHoliday.holiday_name
        },

        time: currentTime,

        error:
          `Hari ini libur: ${specialHoliday.holiday_name}.`

      });

    }


    // =================================================
    // 8. CEK LIBUR RUTIN MINGGUAN
    // =================================================

    const weeklyHolidayResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/school_weekly_holidays` +
        `?day_of_week=eq.${dayOfWeek}` +
        `&active=eq.true` +
        `&select=id,description` +
        `&limit=1`,
        {
          headers:
            serviceHeaders(
              SUPABASE_SERVICE_KEY
            )
        }
      );


    if (!weeklyHolidayResponse.ok) {

      return res.status(500).json({
        success: false,
        error:
          "Libur rutin tidak dapat diperiksa."
      });

    }


    const weeklyHolidayData =
      await weeklyHolidayResponse.json();


    const weeklyHoliday =
      weeklyHolidayData[0];


    if (weeklyHoliday) {

      return res.status(409).json({

        success: false,

        type: "HOLIDAY",

        teacher: {
          id: teacher.id,
          full_name: teacher.full_name,
          nip: teacher.nip || "",
          subject_name: teacher.subject_name || ""
        },

        holiday: {
          type: "WEEKLY",
          name:
            weeklyHoliday.description ||
            "Hari libur rutin"
        },

        time: currentTime,

        error:
          weeklyHoliday.description
          ?
          `Hari ini libur: ${weeklyHoliday.description}.`
          :
          "Hari ini merupakan hari libur madrasah."

      });

    }


    // =================================================
    // 9. CEK HARI WAJIB HADIR
    // =================================================

    const workDayResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/teacher_work_days` +
        `?teacher_id=eq.${teacher.id}` +
        `&day_of_week=eq.${dayOfWeek}` +
        `&active=eq.true` +
        `&select=id,day_of_week,check_in_deadline` +
        `&limit=1`,
        {
          headers:
            serviceHeaders(
              SUPABASE_SERVICE_KEY
            )
        }
      );


    if (!workDayResponse.ok) {

      return res.status(500).json({
        success: false,
        error:
          "Hari kehadiran guru tidak dapat dibaca."
      });

    }


    const workDayData =
      await workDayResponse.json();


    const workDay =
      workDayData[0];


    if (!workDay) {

      return res.status(409).json({

        success: false,

        type: "NO_SCHEDULE",

        teacher: {
          id: teacher.id,
          full_name: teacher.full_name,
          nip: teacher.nip || "",
          subject_name: teacher.subject_name || ""
        },

        time: currentTime,

        error:
          `${teacher.full_name} tidak memiliki jadwal wajib hadir hari ini.`

      });

    }


    // =================================================
    // 10. BATAS HADIR
    // =================================================

    const deadline =
      workDay.check_in_deadline ||
      settings.default_check_in_deadline ||
      "07:00:00";


    const deadlineSeconds =
      timeToSeconds(
        deadline
      );


    const toleranceMinutes =
      Number(
        settings.late_tolerance_minutes ||
        0
      );


    const toleranceSeconds =
      toleranceMinutes * 60;


    // =================================================
    // 11. CEK ABSENSI HARI INI
    // =================================================

    const attendanceResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/attendance` +
        `?teacher_id=eq.${teacher.id}` +
        `&attendance_date=eq.${attendanceDate}` +
        `&select=*` +
        `&limit=1`,
        {
          headers:
            serviceHeaders(
              SUPABASE_SERVICE_KEY
            )
        }
      );


    if (!attendanceResponse.ok) {

      return res.status(500).json({
        success: false,
        error:
          "Data absensi tidak dapat dibaca."
      });

    }


    const attendanceData =
      await attendanceResponse.json();


    const attendance =
      attendanceData[0];


    // =================================================
    // 12. CHECK IN
    // =================================================

    if (!attendance) {

      const lateSeconds =
        currentSeconds -
        deadlineSeconds;


      let status =
        "HADIR";


      let lateMinutes =
        0;


      if (
        lateSeconds >
        toleranceSeconds
      ) {

        status =
          "TERLAMBAT";


        lateMinutes =
          Math.ceil(
            lateSeconds / 60
          );

      }


      const insertResponse =
        await fetch(
          `${SUPABASE_URL}/rest/v1/attendance`,
          {
            method: "POST",

            headers: {
              ...serviceHeaders(
                SUPABASE_SERVICE_KEY
              ),

              "Content-Type":
                "application/json",

              Prefer:
                "return=representation"
            },

            body:
              JSON.stringify({

                teacher_id:
                  teacher.id,

                attendance_date:
                  attendanceDate,

                scheduled_start:
                  deadline,

                check_in:
                  now.toISOString(),

                check_in_method:
                  "QR_KIOSK",

                status:
                  status,

                late_minutes:
                  lateMinutes

              })
          }
        );


      const inserted =
        await insertResponse.json();


      if (!insertResponse.ok) {

        return res.status(500).json({
          success: false,
          error:
            inserted.message ||
            "Absen masuk gagal disimpan."
        });

      }


      let description;


      if (
        status === "TERLAMBAT"
      ) {

        description =
          `Terlambat ${lateMinutes} menit`;

      }
      else {

        const earlySeconds =
          deadlineSeconds -
          currentSeconds;


        const earlyMinutes =
          Math.floor(
            Math.max(
              0,
              earlySeconds
            ) / 60
          );


        description =
          earlyMinutes > 0
          ?
          `Hadir ${earlyMinutes} menit sebelum batas waktu`
          :
          "Hadir tepat waktu";

      }


      return res.status(200).json({

        success: true,

        action: "CHECK_IN",

        message:
          "Absen masuk berhasil",

        teacher: {
          id: teacher.id,
          full_name: teacher.full_name,
          nip: teacher.nip || "",
          subject_name: teacher.subject_name || ""
        },

        attendance: {
          time: currentTime,
          status: status,
          late_minutes: lateMinutes,
          deadline: formatTime(deadline),
          method: "QR_KIOSK",
          description: description
        }

      });

    }


    // =================================================
    // 13. ABSENSI SUDAH LENGKAP
    // =================================================

    if (
      attendance.check_out
    ) {

      return res.status(409).json({

        success: false,

        type:
          "ATTENDANCE_COMPLETE",

        teacher: {
          full_name:
            teacher.full_name,
          nip: teacher.nip || "",
          subject_name: teacher.subject_name || ""
        },

        error:
          "Absensi masuk dan pulang hari ini sudah lengkap."

      });

    }


    // =================================================
    // 14. CEGAH DOUBLE SCAN
    // =================================================

    if (
      attendance.check_in
    ) {

      const checkIn =
        new Date(
          attendance.check_in
        );


      const differenceMinutes =
        (
          now.getTime() -
          checkIn.getTime()
        ) / 60000;


      if (
        differenceMinutes < 2
      ) {

        return res.status(409).json({

          success: false,

          type:
            "DUPLICATE_SCAN",

          teacher: {
            full_name:
              teacher.full_name,
            nip: teacher.nip || "",
            subject_name: teacher.subject_name || ""
          },

          error:
            "Absen masuk sudah tercatat. Tidak perlu scan ulang."

        });

      }

    }


    // =================================================
    // 15. JAM PULANG
    // =================================================

    const checkoutStart =
      settings.check_out_start ||
      "12:30:00";


    const checkoutSeconds =
      timeToSeconds(
        checkoutStart
      );


    if (
      currentSeconds <
      checkoutSeconds
    ) {

      return res.status(409).json({

        success: false,

        type:
          "TOO_EARLY_CHECKOUT",

        teacher: {
          full_name:
            teacher.full_name,
          nip: teacher.nip || "",
          subject_name: teacher.subject_name || ""
        },

        checkout_start:
          formatTime(
            checkoutStart
          ),

        error:
          `Belum waktunya absen pulang. ` +
          `Absen pulang mulai pukul ${formatTime(checkoutStart)}.`

      });

    }


    // =================================================
    // 16. CHECK OUT
    // =================================================

    const updateResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/attendance` +
        `?id=eq.${attendance.id}`,
        {
          method: "PATCH",

          headers: {
            ...serviceHeaders(
              SUPABASE_SERVICE_KEY
            ),

            "Content-Type":
              "application/json",

            Prefer:
              "return=representation"
          },

          body:
            JSON.stringify({

              check_out:
                now.toISOString(),

              check_out_method:
                "QR_KIOSK",

              updated_at:
                now.toISOString()

            })
        }
      );


    const updated =
      await updateResponse.json();


    if (!updateResponse.ok) {

      return res.status(500).json({
        success: false,
        error:
          updated.message ||
          "Absen pulang gagal disimpan."
      });

    }


    return res.status(200).json({

      success: true,

      action:
        "CHECK_OUT",

      message:
        "Absen pulang berhasil",

      teacher: {
        id:
          teacher.id,

        full_name:
          teacher.full_name
      },

      attendance: {
        time:
          currentTime,

        checkout_start:
          formatTime(
            checkoutStart
          ),

        method:
          "QR_KIOSK"
      }

    });


  }
  catch(error) {

    console.error(
      "KIOSK SCAN ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      error:
        "Terjadi kesalahan pada server kiosk."

    });

  }

};


// =====================================================
// SERVICE HEADERS
// =====================================================

function serviceHeaders(key){

  return {
    apikey: key,
    Authorization:
      `Bearer ${key}`
  };

}


// =====================================================
// TIME → DETIK
// =====================================================

function timeToSeconds(time){

  if (!time) {
    return 0;
  }


  const parts =
    time.split(":");


  const hour =
    Number(parts[0] || 0);


  const minute =
    Number(parts[1] || 0);


  const second =
    Number(parts[2] || 0);


  return (
    hour * 3600
  ) +
  (
    minute * 60
  ) +
  second;

}


// =====================================================
// FORMAT HH:MM
// =====================================================

function formatTime(time){

  if (!time) {
    return "-";
  }


  return time.substring(
    0,
    5
  );

}


// =====================================================
// WAKTU LOKAL
// =====================================================

function getLocalDateTimeParts(
  date,
  timezone
){

  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          timezone,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hourCycle:
          "h23"
      }
    );


  const parts =
    formatter.formatToParts(
      date
    );


  const result = {};


  for (
    const part of parts
  ) {

    if (
      part.type !== "literal"
    ) {

      result[part.type] =
        part.value;

    }

  }


  return result;

}


// =====================================================
// HARI DATABASE
// 1 SENIN ... 7 AHAD
// =====================================================

function getDayOfWeek(
  date,
  timezone
){

  const day =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          timezone,

        weekday:
          "short"
      }
    )
    .format(
      date
    );


  const map = {
    Mon:1,
    Tue:2,
    Wed:3,
    Thu:4,
    Fri:5,
    Sat:6,
    Sun:7
  };


  return map[day];

}
