import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import cors from "cors";

// IP 요청 데이터 타입 정의
interface RequestData {
  count: number;
  startTime: number;
}

const app = express();
const RATE_LIMIT = 1 * 60 * 1000; // 1분 (밀리초 단위)
const MAX_REQUESTS = 100; // 1분 동안 허용할 최대 요청 수
const whitelist = ["http://localhost:3000"]; // 접속 허용 주소
const secretKey = "your-secret-key"; // 실제로는 보안에 강한 랜덤한 키를 사용해야 합니다.
// 메모리 기반 데이터 저장소 (IP별 요청 데이터 관리)
const ipRequestCounts: Map<string, RequestData> = new Map();

// Mock database (in-memory)
let posts = [
  { id: 1, title: "첫 번째 게시물", content: "첫 번째 게시물 내용" },
  { id: 2, title: "두 번째 게시물", content: "두 번째 게시물 내용" },
];

let todos = [
  { id: 1, text: "Learn Node.js" },
  { id: 2, text: "Build a REST API" },
];

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

app.get("/posts", (req, res) => {
  res.json({ posts });
});

app.get("/todos", (req, res) => {
  res.json(todos);
});

app.get("/logout", (req, res) => {
  res.clearCookie("jwt");
  res.redirect("/");
});

app.get("/cookie", (req, res) => {
  res.cookie("cookieName", "cookieValue", {
    expires: new Date(Date.now() + 900000), // 쿠키의 만료일 (현재 시간 + 900000 밀리초)
    httpOnly: true,
  });
  res.send({ message: "쿠키가 설정되었습니다." });
});

app.get("/form", (req, res) => {
  let userNickname = "";
  const jwtCookie = req.cookies.jwt as string;
  if (jwtCookie) {
    const decoded = jwt.verify(jwtCookie, secretKey) as {
      username: string;
      nickname: string;
    };
    userNickname = decoded.nickname;
  }
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    <h1>${userNickname ? `Welcome back, ${userNickname}!` : "Login"}</h1>
    ${
      userNickname
        ? `<p><a href="/logout">Logout</a></p>`
        : `
    <form action="/login" method="post">
      <label for="username">Username:</label>
      <input type="text" id="username" name="username" required />
      <br />
      <label for="password">Password:</label>
      <input type="password" id="password" name="password" required />
      <br />
      <button type="submit">Login</button>
    </form>
    `
    }
  </body>
  </html>
  `);
});

// 포스트
app.post("/posts", (req, res) => {
  const { title, content } = req.body;
  const newPost = { id: Date.now(), title, content };
  posts.push(newPost);
  res.status(201).json({ post: newPost });
});

app.post("/todos", (req, res) => {
  const { text } = req.body;
  const newTodo = { id: todos.length + 1, text };
  todos.push(newTodo);
  res.status(200).json(newTodo);
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

// put 통신
app.put("/posts/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const { title, content } = req.body;
  const index = posts.findIndex((post) => post.id === id);
  if (index !== -1) {
    posts[index] = { id, title, content };
    res.json({ post: posts[index] });
  } else {
    res.status(404).json({ error: "Post not found" });
  }
});

app.put("/todos/:id", (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const todo = todos.find((todo) => todo.id === parseInt(id));
  if (todo) {
    todo.text = text;
    res.json(todo);
  } else {
    return res.status(404).json({ error: "Todo not found" });
  }
});

// delete 통신
app.delete("/posts/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const index = posts.findIndex((post) => post.id === id);
  if (index !== -1) {
    posts.splice(index, 1);
    res.sendStatus(204);
  } else {
    res.status(404).json({ error: "Post not found" });
  }
});

app.delete("/todos/:id", (req, res) => {
  const { id } = req.params;
  const todo = todos.find((todo) => todo.id === parseInt(id));
  if (todo) {
    todos = todos.filter((todo) => todo.id !== parseInt(id));
    res.status(200).json({ message: "Todo deleted successfully" });
  } else {
    return res.status(404).json({ error: "Todo not found" });
  }
});

app.listen(app.get("port"), app.get("host"), () =>
  console.log(
    "Server is running on : " + app.get("host") + ":" + app.get("port")
  )
);
