// auth-client.js

document.addEventListener('DOMContentLoaded', () => {
  // Hacer fetch a rutas protegidas y abrir el modal si es necesario
  document.querySelectorAll('.protected-route').forEach(link => {
    link.addEventListener('click', function(event) {
      event.preventDefault();

      fetch(this.href, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      .then(response => {
        if (response.status === 401) {
          // Si el backend devuelve que es necesario iniciar sesión, abrimos el modal
          $('#signinModal').modal('show');
          throw new Error('Login required');
        }
        window.location.href = this.href; // Redirigir si está autenticado
      })
      .catch(error => {
        console.error('Error:', error);
      });
    });
  });
});

// Enviar el formulario de inicio de sesión mediante AJAX
document.getElementById('signin-form').addEventListener('submit', function(event) {
  event.preventDefault();

  const formData = new FormData(this);

  fetch('/signin', {
    method: 'POST',
    body: formData
  })
  .then(response => {
    if (response.ok) {
      // Cerrar el modal y recargar la página actual
      $('#signinModal').modal('hide');
      window.location.reload();
    } else {
      return response.text().then(text => {
        alert('Error al iniciar sesión: ' + text);
      });
    }
  })
  .catch(error => {
    console.error('Error en el inicio de sesión:', error);
  });
});
