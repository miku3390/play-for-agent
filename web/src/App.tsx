import { Link, Route, Routes } from "react-router-dom";
import Watch from "./pages/Watch"
import Evolution from "./pages/Evolution";
import StagHunt from "./pages/StagHunt";
import Guess23 from "./pages/Guess23";

function Home() {
  return <h1>Handkerchief Arena</h1>;
}

function Agents() {
  return <h1>我的策略（TODO: 对接 Agent Service）</h1>;
}

function Matches() {
  return <h1>对局列表（TODO: 对接 Match Service）</h1>;
}

export default function App() {
  return (
    <div>
      <nav>
        <Link to="/">首页</Link> | <Link to="/agents">策略</Link> |{" "}
        <Link to="/matches">对局</Link> | <Link to="/watch">观战</Link> | <Link to="/evolution">信任进化</Link> | <Link to="/staghunt">猎鹿博弈</Link> |{" "}
        <Link to="/guess23">猜 2/3</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/watch" element={<Watch />} />
        <Route path="/evolution" element={<Evolution />} />
        <Route path="/staghunt" element={<StagHunt />} />
        <Route path="/guess23" element={<Guess23 />} />
      </Routes>
    </div>
  );
}