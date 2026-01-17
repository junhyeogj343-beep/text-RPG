const express = require('express');
const app = express();
const path = require('path');

// 1. 유저가 접속했을 때 index.html 파일을 보내주는 설정
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. 서버 실행 포트 설정 (Render 배포를 고려한 설정)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`서버가 가동되었습니다! 접속 주소: http://localhost:${PORT}`);
});