import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import mysql from "mysql2/promise";
import jwt from "jsonwebtoken";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";

// IP 요청 데이터 타입 정의
interface RequestData {
  count: number;
  startTime: number;
}

interface BnumResult extends mysql.RowDataPacket {
  bnum: number;
}

interface BoardResult extends mysql.RowDataPacket {
  bnum: number;
  id: string;
  title: string;
  content: string;
  writedate: string;
}

interface ImageResult extends mysql.RowDataPacket {
  fnum: number;
  bnum: number;
  savefile: string;
  filetype: string;
  writedate: string;
}

const app = express();
const RATE_LIMIT = 1 * 60 * 1000; // 1분 (밀리초 단위)
const MAX_REQUESTS = 100; // 1분 동안 허용할 최대 요청 수
const whitelist = ["http://localhost:3000"]; // 접속 허용 주소
const secretKey = "your-secret-key"; // 실제로는 보안에 강한 랜덤한 키를 사용해야 합니다.
const ipRequestCounts: Map<string, RequestData> = new Map(); // 메모리 기반 데이터 저장소 (IP별 요청 데이터 관리)

// 데이터 베이스 연결
const conn = mysql.createPool({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "",
  database: "nodeboard",
});

// 저장소 폴더 관리
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      const uploadPath = "./uploads/";
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      callback(null, uploadPath);
    },
    filename: (req, file, callback) => {
      const uniqueName = Date.now() + "-" + file.originalname;
      callback(null, uniqueName);
    },
  }),
});

const users = [
  { username: "user1", password: "pass1", nickname: "User One" },
  { username: "user2", password: "pass2", nickname: "User Two" },
];

app.set("port", process.env.PORT || 3000);
app.set("host", process.env.HOST || "0.0.0.0");

// API 경로에 미들웨어 적용
app.use((req, res, next) => {
  const clientIp = req.ip; // 클라이언트 IP 가져오기
  const currentTime = Date.now();
  // 클라이언트 요청이 favicon.ico라면 로그를 출력하지 않음
  if (req.path === "/favicon.ico") {
    return next();
  }
  // 해당 IP의 요청 기록이 없으면 초기화
  if (!ipRequestCounts.has(clientIp)) {
    ipRequestCounts.set(clientIp, { count: 1, startTime: currentTime });
    console.log(`[${clientIp}] 접속 횟수: 1`);
    return next();
  }
  // IP의 요청 데이터 가져오기
  const requestData = ipRequestCounts.get(clientIp)!; // 데이터가 반드시 존재함을 단언
  const elapsedTime = currentTime - requestData.startTime;
  // 제한 시간 (RATE_LIMIT)이 지났으면 초기화
  if (elapsedTime > RATE_LIMIT) {
    ipRequestCounts.set(clientIp, { count: 1, startTime: currentTime });
    console.log(`[${clientIp}] 접속 횟수: 1`);
    return next();
  }
  // 요청 횟수 증가
  requestData.count += 1;
  ipRequestCounts.set(clientIp, requestData); // 업데이트
  // 로그 출력
  console.log(`[${clientIp}] 접속 횟수: ${requestData.count}`);
  // 요청 제한을 초과했더라도 요청을 계속 처리
  if (requestData.count > MAX_REQUESTS) {
    res.setHeader("X-RateLimit-Exceeded", "true"); // 제한 초과 여부를 헤더에 추가
    return res.status(429).json({
      error: "Too many requests. Please try again later.",
      requestCount: requestData.count,
    });
  }
  next();
});

// Middleware 설정
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  cors({
    origin(req, res) {
      console.log("접속된 주소: " + req),
        -1 == whitelist.indexOf(req || "") && req
          ? res(Error("허가되지 않은 주소입니다."))
          : res(null, !0);
    },
    credentials: !0,
    optionsSuccessStatus: 200,
  })
);

app.all("/*", (req, res, next: () => void) => {
  const ip = req.headers.origin;
  if (whitelist.indexOf(ip as string) !== -1 || !ip) {
    res.header("Access-Control-Allow-Origin", ip as string);
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
  }
});

// get 통신
app.get("/", function (req, res) {
  res.send("접속된 아이피: " + req.ip);
});

app.get("/logout", (req, res) => {
  res.clearCookie("jwt");
  res.redirect("/form");
});

app.get("/cookie", (req, res) => {
  res.cookie("cookieName", "cookieValue", {
    expires: new Date(Date.now() + 900000), // 쿠키의 만료일 (현재 시간 + 900000 밀리초)
    httpOnly: true,
  });
  res.send({ message: "쿠키가 설정되었습니다." });
});

app.get("/view", async (req, res) => {
  try {
    const [rows] = await conn.query<BoardResult[]>("SELECT * FROM board");
    res.json(rows);
  } catch (err) {
    console.error("Query execution failed:", err);
    res.status(500).send("Server error");
  }
});

app.get("/read/:bnum", async (req, res) => {
  try {
    const { bnum } = req.params;
    const [rows] = await conn.query<BoardResult[]>(
      "SELECT * FROM board WHERE bnum = ?",
      [bnum]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("Query execution failed:", err);
    res.status(500).send("Server error");
  }
});

app.get("/img/:bnum", async (req, res) => {
  try {
    const { bnum } = req.params;
    const [rows] = await conn.query<ImageResult[]>(
      "SELECT * FROM file WHERE bnum = ?",
      [bnum]
    );
    if (rows.length > 0) {
      const filePath = path.join("uploads", rows[0].savefile);
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath, { root: "." });
      } else {
        res.status(404).send("File not found");
      }
    } else {
      res.status(404).send("No file found for this board");
    }
  } catch (err) {
    console.error("Query execution failed:", err);
    res.status(500).send("Server error");
  }
});

app.get("/form", (req, res) => {
  const jwtCookie = req.cookies.jwt as string;
  if (jwtCookie) {
    try {
      const decoded = jwt.verify(jwtCookie, secretKey) as {
        username: string;
        nickname: string;
      };
      const { nickname } = decoded;
      if (nickname) {
        res.send(`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    <h1>${`Welcome back, ${nickname}!`}</h1>
    <p><a href="/logout">Logout</a></p>
  </body>
</html>
          `);
      } else {
        res.sendFile(path.join(__dirname, "login.html"));
      }
    } catch {
      res.clearCookie("jwt");
      res.redirect("/form");
    }
  } else {
    res.sendFile(path.join(__dirname, "login.html"));
  }
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.username === username && u.password === password
  );
  if (user) {
    const { username, nickname } = user;
    const jwtToken = jwt.sign({ username, nickname }, secretKey, {
      expiresIn: "1h",
    });
    res.cookie("jwt", jwtToken, { httpOnly: true });
    res.send({ message: `Login successful! Welcome, ${nickname}!` });
  } else {
    res.status(403).send({ smessage: "Invalid username or password" });
  }
});

app.post("/insert", upload.single("img"), async (req, res) => {
  try {
    const body = req.body;
    const [rows] = await conn.query<BnumResult[]>(
      "SELECT COUNT(*) + 1 AS bnum FROM board"
    );
    const { bnum } = rows[0];
    const sql =
      "INSERT INTO board (bnum, id, title, content, writedate) VALUES (?, ?, ?, ?, NOW())";
    const params = [bnum, body.id, body.title, body.content];
    await conn.query(sql, params);
    if (req.file) {
      const fileSql =
        "INSERT INTO file (bnum, savefile, filetype, writedate) VALUES (?, ?, ?, NOW())";
      const fileParams = [bnum, req.file.filename, req.file.mimetype];
      await conn.query(fileSql, fileParams);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Query execution failed:", err);
    res.status(500).send("Server error");
  }
});

// put 통신
app.put("/update/:bnum", async (req, res) => {
  try {
    const { bnum } = req.params;
    const { id, title, content } = req.body;
    const sql =
      "UPDATE board SET id = ?, title = ?, content = ? WHERE bnum = ?";
    await conn.query(sql, [id, title, content, bnum]);
    res.sendStatus(200);
  } catch (err) {
    console.error("Query execution failed:", err);
    res.status(500).send("Server error");
  }
});

// delete 통신
app.delete("/delete/:bnum", async (req, res) => {
  try {
    const { bnum } = req.params;
    await conn.query("DELETE FROM board WHERE bnum = ?", [bnum]);
    res.sendStatus(200);
  } catch (err) {
    console.error("Query execution failed:", err);
    res.status(500).send("Server error");
  }
});

app.listen(app.get("port"), app.get("host"), () =>
  console.log(
    "Server is running on : " + app.get("host") + ":" + app.get("port")
  )
);
