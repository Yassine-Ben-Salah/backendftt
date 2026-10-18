export function notFound(req, res) {
  res.status(404).json({ error: 'Ressource introuvable.' });
}

export function errorHandler(error, req, res, next) {
  console.error(error);
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Le fichier ne doit pas dépasser 5 Mo.' });
  }
  if (error.name === 'MulterError') {
    return res.status(400).json({ error: 'Fichier image invalide.' });
  }
  return res.status(error.status || 500).json({
    error: error.status ? error.message : 'Une erreur serveur est survenue.'
  });
}