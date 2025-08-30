import bcrypt from 'bcryptjs';
const pass = process.argv[2] || 'password123';
bcrypt.hash(pass, 10, (err, hash) => {
  if (err) throw err;
  console.log(hash);
});
