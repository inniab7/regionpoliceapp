// Design Ref: §4.1 (nice) — 시작 화면: 흰 바탕 가운데 경찰 마크, 아래에 작은 글씨 문구와 제작자 표시
// Plan: 작업 38 — 홈 화면 추가. 앱을 처음 열 때(탭마다 한 번) 잠깐 보이고 저절로 사라진다.
// CSS 애니메이션으로 사라지게 해서, 화면이 뜨는 첫 순간부터 보인다. 같은 탭에서 다시 불러올 때는 SplashGate가 숨긴다.
import Image from "next/image";
import SplashGate from "./SplashGate";

export default function SplashScreen() {
  return (
    <>
      <SplashGate />
      <div className="splash" aria-hidden="true">
        <Image src="/emblem.png" alt="" width={240} height={149} priority unoptimized className="h-auto w-48" />
        <p className="splash-tagline">현장에 답이 있다. (사선에서 뛰는 동료를 위하여)</p>
        <p className="splash-credit">Produce. Yuni</p>
      </div>
    </>
  );
}
