const db = require('./database');

// Obtener las secciones de un curso
function getSectionsByCourse(courseId, callback) {
    const query = `SELECT * FROM sections WHERE course_id = ?`;
    
    db.query(query, [courseId], (err, results) => {
        if (err) {
            return callback(err);
        }
        callback(null, results);
    });
}

module.exports = { getSectionsByCourse };
