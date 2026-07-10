export default function HeurekaWidget() {
  const positionId = process.env.HEUREKA_WIDGET_POSITION_ID?.trim();

  if (!positionId) return null;

  return (
    <div
      className="heureka-affiliate-searchpanel"
      data-trixam-positionid={positionId}
      data-trixam-codetype="iframe"
      data-trixam-linktarget="top"
    />
  );
}
