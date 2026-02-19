# -*- coding: utf-8 -*-
{
    'name': "acceso_ies",

    'summary': "Módulo de base de datos para acceso a IES",

    'description': """
        Módulo para gestionar el acceso a IES:
        - Registro de estudiantes, profesores y personal administrativo.
        - Gestión de permisos de acceso según roles.
            - Integración con sistemas de control de acceso físico (NFC).
    """,

    'author': "NFCitos",
    'website': "https://www.yourcompany.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/15.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'Tools',
    'version': '1.0',

    # any module necessary for this one to work correctly
    'depends': ['base'],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'security/security.xml',
        'views/views.xml',
    ],
    'application': True,
    'installable': True,
}
