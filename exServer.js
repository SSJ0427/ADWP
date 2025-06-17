const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const app = express();
const port = 3000;
const dataPath = path.join(__dirname, 'data/championdata.json');

// 업로드된 이미지 저장 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'static/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// 정적 파일 제공
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// EJS 템플릿 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 임시 챔피언 데이터
let champions = [];
let nextId = 1;

if (fs.existsSync(dataPath)) {
  const jsonData = fs.readFileSync(dataPath);
  champions = JSON.parse(jsonData);
  const maxId = champions.reduce((max, c) => Math.max(max, c.id), 0);
  nextId = maxId + 1;
}

// 루트 페이지 - 챔피언 도감
app.get('/', (req, res) => {
  res.render('championList', { champions });
});

// 챔피언 삭제 처리
app.post('/delete/:id', (req, res) => {
  const id = parseInt(req.params.id);
  champions = champions.filter(c => c.id !== id);
  res.redirect('/');
});

// 챔피언 생성 페이지
app.get('/create', (req, res) => {
  res.render('championCreate');
});

// 챔피언 생성 처리
app.post('/create', upload.fields([
  { name: 'championImg' },
  { name: 'skillqImg' },
  { name: 'skillwImg' },
  { name: 'skilleImg' },
  { name: 'skillrImg' },
]), (req, res) => {
  const body = req.body;
  const files = req.files;

  const newChampion = {
    id: nextId++,
    name: body.name,
    alias: body.alias,
    position: body.position,
    role: body.role,
    story: body.story,
    image: files.championImg?.[0]?.filename || '',
    skills: ['q', 'w', 'e', 'r'].map(i => ({
      name: body[`skill${i}Name`],
      desc: body[`skill${i}Desc`],
      image: files[`skill${i}Img`]?.[0]?.filename || ''
    }))
  };

champions.push(newChampion);
fs.writeFileSync(dataPath, JSON.stringify(champions, null, 2));
res.redirect(`/champion/${newChampion.id}`);

});

// 챔피언 상세 페이지
app.get('/champion/:id', (req, res) => {
  const champ = champions.find(c => c.id == req.params.id);
  if (!champ) return res.status(404).send('챔피언을 찾을 수 없습니다.');
  res.render('championDetail', { champion: champ });
});

app.listen(port, () => {
  console.log(`서버가 http://localhost:${port} 에서 실행 중입니다`);
});
