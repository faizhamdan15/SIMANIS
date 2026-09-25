module.exports = async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Robots-Tag","noindex, nofollow");
  return res.status(410).json({
    success:false,
    deprecated:true,
    error:"Endpoint kiosk/kartu guru lama telah dinonaktifkan. Gunakan modul Absensi Guru terintegrasi SIMANIS."
  });
};
