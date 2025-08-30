const { exec } = require('child_process');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

async function sendBackupEmail() {
  const file = path.join(__dirname, '..', `backup_${Date.now()}.json`);
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not set');
  const cmd = `mongoexport --uri="${uri}" --collection=applicants --out="${file}" --jsonArray`;
  await new Promise((resolve, reject)=> exec(cmd, (err, stdout, stderr)=> err? reject(stderr||err): resolve(stdout)));
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT||587),
    secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({ from: process.env.SMTP_USER, to: process.env.BACKUP_EMAIL, subject: 'Backup', text: 'Attached backup', attachments:[{ filename: path.basename(file), path: file }] });
  try { fs.unlinkSync(file); } catch(e){}
}

module.exports = { sendBackupEmail };
