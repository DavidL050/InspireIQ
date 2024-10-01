const db = require('./database');

// Obtener todos los cursos
function getCourses(callback) {
    const query = `SELECT * FROM courses`;
    
    db.query(query, (err, results) => {
        if (err) {
            return callback(err);
        }
        callback(null, results);
    });
}

// Obtener curso por ID
function getCourseById(courseId, callback) {
    const query = `SELECT * FROM courses WHERE course_id = ?`;
    
    db.query(query, [courseId], (err, results) => {
        if (err) {
            return callback(err);
        }
        callback(null, results[0]);
    });
}

module.exports = { getCourses, getCourseById };
