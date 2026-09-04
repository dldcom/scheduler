export default function CopyExample() {
  return (
    <div className="copy-example" aria-label="표 전체 선택 예시">
      <div className="copy-example-title">표 전체를 선택한 뒤 Ctrl + C</div>
      <div className="copy-example-previews">
        {["한글", "Excel"].map((name) => (
          <div className="copy-example-app" key={name}>
            <span>{name}</span>
            <div className="copy-example-grid">
              {Array.from({ length: 15 }, (_, index) => <i key={index} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
