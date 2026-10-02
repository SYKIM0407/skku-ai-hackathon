// 시작 화면 자리 표시. 실제 화면은 T-20(S)에서 만든다.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <h1 className="text-4xl font-bold">🤔 갸웃</h1>
      <p className="text-gray-600">수업을 함께 듣고, 학생과 교수 사이에서 대신 손을 들어 주는 AI</p>
    </main>
  );
}
