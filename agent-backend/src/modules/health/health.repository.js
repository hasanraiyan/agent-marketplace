const fetchServerStatus = () => {
  return { uptime: process.uptime() };
};

export default { fetchServerStatus };
