import Icon from './Icon.jsx'

function SectionPage({ section }) {
  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <div className="page-kicker"><span /> FARM PLANNING <span className="kicker-divider">/</span> THE GAMBIA</div>
          <h1>{section.label}</h1>
          <p>{section.description}</p>
        </div>
        <span className="page-date">In development</span>
      </div>

      <section className="section-empty-panel">
        <span className="section-empty-icon"><Icon name={section.icon} size={26} /></span>
        <span className="eyebrow">WORKSPACE IN PROGRESS</span>
        <h2>Reliable local context comes first.</h2>
        <p>
          This area will be available when its data sources and decision-support
          guidance are ready. FarmShift AI will distinguish observed data from
          estimates and simulations.
        </p>
      </section>
    </div>
  )
}

export default SectionPage
