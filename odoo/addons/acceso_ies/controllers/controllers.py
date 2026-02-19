# -*- coding: utf-8 -*-
# from odoo import http


# class AccesoIes(http.Controller):
#     @http.route('/acceso_ies/acceso_ies', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/acceso_ies/acceso_ies/objects', auth='public')
#     def list(self, **kw):
#         return http.request.render('acceso_ies.listing', {
#             'root': '/acceso_ies/acceso_ies',
#             'objects': http.request.env['acceso_ies.acceso_ies'].search([]),
#         })

#     @http.route('/acceso_ies/acceso_ies/objects/<model("acceso_ies.acceso_ies"):obj>', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('acceso_ies.object', {
#             'object': obj
#         })

