import Icon from './Icon.jsx'

function LoadState({ resource, loadingMessage = 'Loading data…' }) {
  if (resource.status === 'loading') {
    return (
      <p className="load-state" role="status">
        <span aria-hidden="true" className="spinner" /> {loadingMessage}
      </p>
    )
  }
  if (resource.status === 'error') {
    return (
      <div className="load-state load-state--error" role="alert">
        <span>{resource.error}</span>
        <button className="text-button" onClick={resource.retry} type="button">
          <Icon name="refresh" size={14} /> Retry
        </button>
      </div>
    )
  }
  return null
}

export default LoadState
