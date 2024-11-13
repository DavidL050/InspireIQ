$(document).ready(function() {
    // Configuración global de AJAX para manejar respuestas del servidor
    $.ajaxSetup({
        statusCode: {
            401: function() {
                $('#signinModal').modal('show'); // Mostrar el modal de inicio de sesión si no está autenticado
            },
            403: function() {
                showAlert('signinAlert', 'No tienes permisos para realizar esta acción', 'danger');
            }
        }
    });

    // Interceptar todos los clics en enlaces que requieran autenticación
    $(document).on('click', 'a[data-requires-auth="true"]', function(e) {
        e.preventDefault();
        const href = $(this).attr('href');
        
        // Verificar autenticación mediante AJAX
        $.get('/check-auth')
            .done(function() {
                // Si está autenticado, proceder con la navegación
                window.location.href = href;
            })
            .fail(function(xhr) {
                if (xhr.status === 401) {
                    sessionStorage.setItem('intendedUrl', href); // Guardar la URL a la que el usuario quería ir
                    $('#signinModal').modal('show'); // Mostrar el modal de inicio de sesión
                }
            });
    });

    // Funciones para cambiar entre modales
    $('#openSigninModal').click(function(event) {
        event.preventDefault();
        $('#signupModal').modal('hide');
        $('#signinModal').modal('show');
    });

    $('#openSignupModal').click(function(event) {
        event.preventDefault();
        $('#signinModal').modal('hide');
        $('#signupModal').modal('show');
    });

    // Cambiar entre formularios de estudiante y profesor
    $('#register-as-teacher').click(function(e) {
        e.preventDefault();
        $('#student-registration-form').hide();
        $('#teacher-registration-form').show();

        // Transferir valores a los campos del formulario de profesor
        $('#teacher-name').val($('#name').val());
        $('#teacher-lastname').val($('#lastname').val());
        $('#teacher-email').val($('#email').val());
        $('#teacher-password').val($('#password').val());
    });

    $('#back-to-student-form').click(function() {
        $('#teacher-registration-form').hide();
        $('#student-registration-form').show();

        // Transferir valores a los campos del formulario de estudiante
        $('#name').val($('#teacher-name').val());
        $('#lastname').val($('#teacher-lastname').val());
        $('#email').val($('#teacher-email').val());
        $('#password').val($('#teacher-password').val());
    });

    // Función para mostrar alertas en los modales
    function showAlert(alertId, message, type) {
        const alert = $(`#${alertId}`);
        alert.removeClass('alert-success alert-danger')
             .addClass(`alert-${type}`)
             .html(message)
             .show();
        
        setTimeout(() => alert.hide(), 5000); // Ocultar la alerta después de 5 segundos
    }

    // Manejar el registro de estudiantes
    $('#student-registration-form').submit(function(e) {
        e.preventDefault();
        const formData = {
            name: $('#name').val(),
            lastname: $('#lastname').val(),
            email: $('#email').val(),
            password: $('#password').val(),
            role: 'student'
        };

        $.ajax({
            url: '/signup',
            method: 'POST',
            data: formData,
            success: function(response) {
                showAlert('signupAlert', '¡Registro exitoso!', 'success');
                setTimeout(() => {
                    const intendedUrl = sessionStorage.getItem('intendedUrl');
                    if (intendedUrl) {
                        sessionStorage.removeItem('intendedUrl');
                        window.location.href = intendedUrl;
                    } else {
                        $('#signupModal').modal('hide');
                        location.reload(); // Recarga la página actual para reflejar el estado autenticado
                    }
                }, 2000);
            },
            error: function(xhr) {
                const errorMessage = xhr.responseJSON?.message || 'Error en el registro. Por favor, intenta nuevamente.';
                showAlert('signupAlert', errorMessage, 'danger');
            }
        });
    });

    // Manejar el registro de profesores
    $('#teacher-registration-form').submit(function(e) {
        e.preventDefault();
        const formData = {
            name: $('#teacher-name').val(),
            lastname: $('#teacher-lastname').val(),
            email: $('#teacher-email').val(),
            password: $('#teacher-password').val(),
            role: 'teacher'
        };

        $.ajax({
            url: '/signup',
            method: 'POST',
            data: formData,
            success: function(response) {
                showAlert('signupAlert', '¡Registro exitoso!', 'success');
                setTimeout(() => {
                    const intendedUrl = sessionStorage.getItem('intendedUrl');
                    if (intendedUrl) {
                        sessionStorage.removeItem('intendedUrl');
                        window.location.href = intendedUrl;
                    } else {
                        $('#signupModal').modal('hide');
                        location.reload();
                    }
                }, 2000);
            },
            error: function(xhr) {
                const errorMessage = xhr.responseJSON?.message || 'Error en el registro. Por favor, intenta nuevamente.';
                showAlert('signupAlert', errorMessage, 'danger');
            }
        });
    });

    // Manejar el inicio de sesión
// Manejar el inicio de sesión
$('#signin-form').submit(function(e) {
    e.preventDefault();
    const formData = {
        email: $('#signin-email').val(),
        password: $('#signin-password').val()
    };

    $.ajax({
        url: '/signin',
        method: 'POST',
        data: formData,
        success: function(response) {
            showAlert('signinAlert', '¡Inicio de sesión exitoso!', 'success');
            setTimeout(() => {
                const intendedUrl = sessionStorage.getItem('intendedUrl');
                if (intendedUrl) {
                    sessionStorage.removeItem('intendedUrl');
                    window.location.href = intendedUrl;
                } else {
                    $('#signinModal').modal('hide');
                    location.reload(); // Recarga la página para mostrar el mensaje de bienvenida
                }
            }, 2000);
        },
        error: function(xhr) {
            const errorMessage = xhr.responseJSON?.message || 'Error en el inicio de sesión. Por favor, verifica tus credenciales.';
            showAlert('signinAlert', errorMessage, 'danger');
        }
    });
});

    // Limpiar formularios y alertas al cerrar los modales
    $('#signupModal').on('hidden.bs.modal', function() {
        $('.registration-form').trigger('reset');
        $('#signupAlert').hide();
        $('#student-registration-form').show();
        $('#teacher-registration-form').hide();
    });

    $('#signinModal').on('hidden.bs.modal', function() {
        $('#signin-form').trigger('reset');
        $('#signinAlert').hide();
    });

    // Detectar si se debe abrir el modal de inicio de sesión
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === 'true') {
        $('#signinModal').modal('show');
    }
});


