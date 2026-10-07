import { Button } from "@/components/ui/button";
import awakening from "@/assets/forgotten-awakening.jpg";

export function AwakeningBackdrop() {
  return <><img className="awakening-image" src={awakening} width={1536} height={1024} alt="A fractured being among the ruins of a forgotten world" /><div className="awakening-shade" /></>;
}

export function AwakeningIntro({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="awakening-screen">
      <AwakeningBackdrop />
      <div className="awakening-brand">FORGOTTEN <span>1,111 BEINGS · SOLANA</span></div>
      <section className="awakening-content intro-content">
        <div className="awakening-clock">11:11</div>
        <p className="lore-eyebrow">THE HOUR OF AWAKENING</p>
        <h1>FORGOTTEN</h1>
        <div className="intro-lore"><p>1,111 beings. Lost to time.</p><p>At 11:11, something stirred.</p><p>Our memories remain fractured.</p><p>Some hide. Some awaken.</p><p>Who will remember you?</p></div>
        <Button className="awakening-cta" onClick={onContinue}>Enter the awakening <span aria-hidden="true">↗</span></Button>
        <p className="awakening-tagline">Remain forgotten.. or become remembered.</p>
      </section>
      <div className="awakening-footer"><span>THE FORGOTTEN PROJECT</span><span>NOT EVERYTHING LOST IS GONE.</span></div>
    </main>
  );
}