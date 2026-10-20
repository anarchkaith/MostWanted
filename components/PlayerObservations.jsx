export default function PlayerObservations({ entry }) {
  const publicObservations = entry.observations.filter(item => item.reportId);
  const observations = publicObservations.length ? publicObservations : [{ source: '', time: entry.time }];
  return <span className="pbp-observations">
    {observations.filter(item => item.source || item.time).map((item, index) => <span className="pbp-observation" key={item.source || index}>
      {item.reportId ? <a href={`/reporte/${encodeURIComponent(item.reportId)}`}>{item.source}</a> : item.source}
      {item.time > 0 && <time dateTime={new Date(item.time * 1000).toISOString()}>{new Date(item.time * 1000).toLocaleString('es-ES')}</time>}
    </span>)}
  </span>;
}
