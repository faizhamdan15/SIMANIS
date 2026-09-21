const crypto = require("crypto");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({
      success: false,
      error: "Method tidak diizinkan."
    });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLIC_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({
      success: false,
      error: "Konfigurasi server belum lengkap."
    });
  }

  try {
    const admin = await requireAdmin({
      req,
      supabaseUrl: SUPABASE_URL,
      publicKey: SUPABASE_PUBLIC_KEY
    });

    if (!admin.ok) {
      return res.status(admin.status).json({
        success: false,
        error: admin.error
      });
    }

    if (req.method === "GET") {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles` +
        `?role=eq.GURU` +
        `&select=id,full_name,nip,subject_name,active,qr_token,qr_enabled` +
        `&order=full_name.asc`,
        {
          headers: serviceHeaders(SUPABASE_SERVICE_KEY)
        }
      );

      const rows = await response.json();

      if (!response.ok) {
        return res.status(500).json({
          success: false,
          error: rows?.message || "Data guru tidak dapat dibaca."
        });
      }

      return res.status(200).json({
        success: true,
        teachers: rows.map(row => ({
          id: row.id,
          full_name: row.full_name,
          nip: row.nip || "",
          subject_name: row.subject_name || "",
          active: row.active === true,
          qr_enabled: row.qr_enabled === true,
          qr_token: row.qr_token || null
        }))
      });
    }

    const { action, teacher_id } = req.body || {};
    const cleanAction = String(action || "").trim().toUpperCase();

    if (!teacher_id || typeof teacher_id !== "string") {
      return res.status(400).json({
        success: false,
        error: "Guru belum dipilih."
      });
    }

    if (!["ISSUE", "REISSUE", "REVOKE"].includes(cleanAction)) {
      return res.status(400).json({
        success: false,
        error: "Aksi kartu tidak valid."
      });
    }

    const teacherResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles` +
      `?id=eq.${encodeURIComponent(teacher_id)}` +
      `&role=eq.GURU` +
      `&select=id,full_name,nip,subject_name,active,qr_token,qr_enabled` +
      `&limit=1`,
      {
        headers: serviceHeaders(SUPABASE_SERVICE_KEY)
      }
    );

    const teacherRows = await teacherResponse.json();
    const teacher = teacherRows?.[0];

    if (!teacherResponse.ok || !teacher) {
      return res.status(404).json({
        success: false,
        error: "Data guru tidak ditemukan."
      });
    }

    if (!teacher.active) {
      return res.status(409).json({
        success: false,
        error: "Akun guru sedang nonaktif. Aktifkan akun terlebih dahulu."
      });
    }

    let patchBody;

    if (cleanAction === "REVOKE") {
      patchBody = {
        qr_token: null,
        qr_enabled: false
      };
    } else {
      const token =
        `MANISKA-GURU-${crypto.randomBytes(24).toString("base64url")}`;

      patchBody = {
        qr_token: token,
        qr_enabled: true
      };
    }

    const patchResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(teacher_id)}`,
      {
        method: "PATCH",
        headers: {
          ...serviceHeaders(SUPABASE_SERVICE_KEY),
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(patchBody)
      }
    );

    const updated = await patchResponse.json();

    if (!patchResponse.ok) {
      return res.status(500).json({
        success: false,
        error: updated?.message || "Kartu guru gagal diperbarui."
      });
    }

    const row = updated?.[0] || {};

    return res.status(200).json({
      success: true,
      action: cleanAction,
      teacher: {
        id: row.id || teacher.id,
        full_name: row.full_name || teacher.full_name,
        nip: row.nip || teacher.nip || "",
        subject_name: row.subject_name || teacher.subject_name || "",
        qr_enabled: row.qr_enabled === true,
        qr_token: row.qr_token || null
      },
      message:
        cleanAction === "REVOKE"
          ? "Kartu guru berhasil dinonaktifkan."
          : cleanAction === "REISSUE"
          ? "Kartu baru berhasil diterbitkan. Kartu lama otomatis tidak berlaku."
          : "Kartu guru berhasil diterbitkan."
    });

  } catch (error) {
    console.error("CARD ADMIN ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Terjadi kesalahan pada server kartu guru."
    });
  }
};

async function requireAdmin({ req, supabaseUrl, publicKey }) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      error: "Sesi admin tidak ditemukan."
    };
  }

  const accessToken = authHeader.substring(7);

  const userResponse = await fetch(
    `${supabaseUrl}/auth/v1/user`,
    {
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!userResponse.ok) {
    return {
      ok: false,
      status: 401,
      error: "Sesi admin tidak valid."
    };
  }

  const user = await userResponse.json();

  const adminResponse = await fetch(
    `${supabaseUrl}/rest/v1/profiles` +
    `?id=eq.${encodeURIComponent(user.id)}` +
    `&select=id,full_name,role,active` +
    `&limit=1`,
    {
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const rows = await adminResponse.json();
  const profile = rows?.[0];

  if (
    !adminResponse.ok ||
    !profile ||
    profile.role !== "ADMIN" ||
    profile.active !== true
  ) {
    return {
      ok: false,
      status: 403,
      error: "Fitur kartu guru hanya dapat digunakan oleh Admin."
    };
  }

  return {
    ok: true,
    admin: profile,
    accessToken
  };
}

function serviceHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}
