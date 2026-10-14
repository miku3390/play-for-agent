import { Link, Route, Routes } from "react-router-dom";

function Home() {
  return <h1>Handkerchief Arena</h1>;
}

function Agents() {
  return <h1>我的策略（TODO: 对接 Agent Service）</h1>;
}

function Matches() {
  return <h1>对局列表（TODO: 对接 Match Service）</h1>;
}

function Watch() {
  return <h1>观战（TODO: WebSocket /ws/matches/:id）</h1>;
}

export default function App() {
  return (
    <div>
      <nav>
        <Link to="/">首页</Link> | <Link to="/agents">策略</Link> |{" "}
        <Link to="/matches">对局</Link> | <Link to="/watch">观战</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/watch" element={<Watch />} />
      </Routes>
    </div>
  );
}
