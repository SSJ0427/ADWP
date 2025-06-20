const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const app = express();
const port = 3000;
const dataPath = path.join(__dirname, 'data/championdata.json');
const axios = require('axios');

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

app.get('/edit/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const champ = champions.find(c => c.id === id);
  if (!champ) return res.status(404).send('챔피언을 찾을 수 없습니다.');
  res.render('championEdit', { champion: champ });
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

app.post('/edit/:id', upload.fields([
  { name: 'championImg' },
  { name: 'skillqImg' },
  { name: 'skillwImg' },
  { name: 'skilleImg' },
  { name: 'skillrImg' },
]), (req, res) => {
  const id = parseInt(req.params.id);
  const champ = champions.find(c => c.id === id);
  if (!champ) return res.status(404).send('챔피언을 찾을 수 없습니다.');

  const body = req.body;
  const files = req.files;

  champ.name = body.name;
  champ.alias = body.alias;
  champ.position = body.position;
  champ.role = body.role;
  champ.story = body.story;

  if (files.championImg?.[0]) champ.image = files.championImg[0].filename;

  ['q', 'w', 'e', 'r'].forEach((key, idx) => {
    if (!champ.skills[idx]) champ.skills[idx] = {};
    champ.skills[idx].name = body[`skill${key}Name`];
    champ.skills[idx].desc = body[`skill${key}Desc`];
    if (files[`skill${key}Img`]?.[0]) {
      champ.skills[idx].image = files[`skill${key}Img`][0].filename;
    }
  });

  fs.writeFileSync(dataPath, JSON.stringify(champions, null, 2));
  res.redirect(`/champion/${id}`);
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

app.get('/', async (req, res) => {
  const keyword = req.query.search?.toLowerCase() || '';
  const sort = req.query.sort || 'id';

  // 창작 챔피언 필터링
  let filtered = champions.filter(c =>
    c.name.toLowerCase().includes(keyword) ||
    c.alias.toLowerCase().includes(keyword) ||
    c.position.toLowerCase().includes(keyword)
  );

  if (sort === 'name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    filtered.sort((a, b) => a.id - b.id);
  }

  // Riot 챔피언 불러오기
  let riotChampions = [];
  try {
    const response = await axios('https://ddragon.leagueoflegends.com/cdn/14.11.1/data/ko_KR/champion.json');
    const json = response.data;
    riotChampions = Object.values(json.data);
  } catch (error) {
    console.error('공식 챔피언 로딩 실패:', error);
  }

  res.render('championList', {
    champions: filtered,
    riotChampions,
    searchKeyword: req.query.search || '',
    sortOption: sort
  });
});

app.get('/riot/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const response = await axios.get(`https://ddragon.leagueoflegends.com/cdn/14.11.1/data/ko_KR/${id}.json`);
    const champ = response.data.data[id];

    res.render('riotChampionDetail', { champ });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('공식 챔피언 정보를 불러올 수 없습니다.');
  }
});
