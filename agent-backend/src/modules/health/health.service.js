import healthRepository from './health.repository.js';

const getHealth = () => {
  const repoData = healthRepository.fetchServerStatus();
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: repoData.uptime,
  };
};

export default { getHealth };
