# -*- coding: utf-8 -*-
from odoo import models, fields, api

class Profesor(models.Model):
    _name = 'acceso_ies.profesor'
    _description = 'Profesorado'
    _rec_name = 'nombre'

    nombre = fields.Char(string='Nombre', required=True)
    apellidos = fields.Char(string='Apellidos', required=True)
    dni = fields.Char(string='DNI', size=9)
    id_NFC = fields.Char(string='ID NFC', index=True)
    
    departamento = fields.Selection([
        ('informatica', 'Informática y Comunicaciones'),
        ('agraria', 'Agraria (Forestales)'),
        ('matematicas', 'Matemáticas'),
        ('lengua', 'Lengua Castellana y Literatura'),
        ('ingles', 'Inglés'),
        ('geografia_historia', 'Geografía e Historia'),
        ('orientacion', 'Orientación'),
        ('educacion_fisica', 'Educación Física'),
        ('fisica_quimica', 'Física y Química'),
        ('biologia_geologia', 'Biología y Geología'),
        ('otros', 'Otros')
    ], string='Departamento')

    _sql_constraints = [
        ('nfc_prof_unique', 'unique(id_NFC)', 'El ID NFC del profesor ya existe.')
    ]

class Estudiante(models.Model):
    _name = 'acceso_ies.estudiante'
    _description = 'Alumnado'
    _rec_name = 'nombre'

    nombre = fields.Char(string='Nombre', required=True)
    apellidos = fields.Char(string='Apellidos', required=True)
    
    curso = fields.Selection([
        ('1eso', '1º de ESO'),
        ('2eso', '2º de ESO'),
        ('3eso', '3º de ESO'),
        ('4eso', '4º de ESO'),
        ('1bach', '1º de Bachillerato'),
        ('2bach', '2º de Bachillerato'),
        ('1smr', '1º CFGM Sistemas Microinformáticos y Redes'),
        ('2smr', '2º CFGM Sistemas Microinformáticos y Redes'),
        ('1dam', '1º CFGS Desarrollo de Aplicaciones Multiplataforma'),
        ('2dam', '2º CFGS Desarrollo de Aplicaciones Multiplataforma'),
        ('1for', '1º CFGM Aprovechamiento y Conservación del Medio Natural'),
        ('2for', '2º CFGM Aprovechamiento y Conservación del Medio Natural'),
        ('1gsfor', '1º CFGS Gestión Forestal y del Medio Natural'),
        ('2gsfor', '2º CFGS Gestión Forestal y del Medio Natural'),
    ], string='Curso', required=True)

    fecha_nacimiento = fields.Date(string='Fecha de Nacimiento', required=True)
    dni = fields.Char(string='DNI', size=9)
    id_NFC = fields.Char(string='ID NFC', index=True)
    recreo = fields.Boolean(string='Permiso Recreo', default=True)
    salida_anticipada = fields.Boolean(string='Salida Anticipada', default=False)
    
    registro_ids = fields.One2many(
        'acceso_ies.asistencia_estudiante', 
        'estudiante_id', 
        string='Asistencias'
    )

    _sql_constraints = [
        ('nfc_est_unique', 'unique(id_NFC)', 'El ID NFC del estudiante ya existe.')
    ]

class AsistenciaProfesor(models.Model):
    _name = 'acceso_ies.asistencia_profesor'
    _description = 'Registro de Asistencia Profesor'
    _order = 'fecha desc'

    fecha = fields.Datetime(string='Fecha', default=fields.Datetime.now, readonly=True)
    profesor_id = fields.Many2one('acceso_ies.profesor', string='Profesor', ondelete='cascade', required=True)
    id_NFC = fields.Char(string='ID NFC', related='profesor_id.id_NFC', readonly=True, store=True)
    estado_asistencia = fields.Selection([
        ('llego al centro', 'Llegó al Centro'),
        ('no llego al centro', 'No Llegó al Centro'),
    ], string='Estado de Asistencia', required=True)

class AsistenciaEstudiante(models.Model):
    _name = 'acceso_ies.asistencia_estudiante'
    _description = 'Registro de Asistencia Estudiante'
    _order = 'fecha desc'

    fecha = fields.Datetime(string='Fecha', default=fields.Datetime.now, readonly=True)
    estudiante_id = fields.Many2one('acceso_ies.estudiante', string='Estudiante', ondelete='cascade', required=True)
    
    curso = fields.Selection(related='estudiante_id.curso', string='Curso', readonly=True, store=True)
    
    id_NFC = fields.Char(string='ID NFC', related='estudiante_id.id_NFC', readonly=True, store=True)
    estado_asistencia = fields.Selection([
        ('llego tarde', 'Llegó Tarde'),
        ('salida anticipada', 'Salida Anticipada'),
    ], string='Estado de Asistencia', required=True)