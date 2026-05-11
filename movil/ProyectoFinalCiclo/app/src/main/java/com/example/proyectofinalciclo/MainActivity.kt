package com.example.proyectofinalciclo

import android.app.PendingIntent
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {

    private var nfcAdapter: NfcAdapter? = null
    private lateinit var estado: TextView
    private lateinit var estadoSesion: TextView
    private lateinit var nombre_xml: TextView
    private lateinit var profesor_xml: TextView
    private lateinit var curso_xml: TextView
    private lateinit var siguiente_xml: Button
    private lateinit var scan: Button
    private lateinit var profile: Button
    private lateinit var salir: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Pa que la barra de navegación del movil no se pelee con los botones de la app
        WindowCompat.setDecorFitsSystemWindows(window, true)
        setContentView(R.layout.activity_main)

        nfcAdapter = NfcAdapter.getDefaultAdapter(this)

        estado = findViewById(R.id.estado)
        estadoSesion = findViewById(R.id.estadoSesion)
        nombre_xml = findViewById(R.id.nombre)
        profesor_xml = findViewById(R.id.txtProfesor)
        curso_xml = findViewById(R.id.curso)
        siguiente_xml = findViewById(R.id.siguiente)
        scan = findViewById(R.id.scan)
        profile = findViewById(R.id.profile)
        salir = findViewById(R.id.salir)

        siguiente_xml.setOnClickListener {
            estado.text = "Escaneando alumno...";
            estado.setTextColor(Color.BLACK);
            curso_xml.visibility = View.GONE
            nombre_xml.text = "";
            nombre_xml.visibility = View.GONE
        }

        scan.setOnClickListener {
            estado.visibility = View.VISIBLE
            estadoSesion.visibility = View.GONE
            estado.text = "Escaneando alumno...";
            estado.setTextColor(Color.BLACK);
            profesor_xml.visibility = View.GONE
            siguiente_xml.visibility = View.VISIBLE
        }

        profile.setOnClickListener {
            if (estadoSesion.text.toString() == "Escanea tu tarjeta para iniciar sesión") {
                estado.visibility = View.GONE
                estadoSesion.visibility = View.VISIBLE
                nombre_xml.visibility = View.GONE
                curso_xml.visibility = View.GONE
                siguiente_xml.visibility = View.GONE
            }
            else {
                estadoSesion.visibility = View.VISIBLE
                estado.visibility = View.GONE
                nombre_xml.visibility = View.GONE
                curso_xml.visibility = View.GONE
            }
        }

        salir.setOnClickListener {
            finishAffinity()
        }

    }

    override fun onResume() {
        super.onResume()
        val intent = Intent(this, javaClass).apply { addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP) }
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val tagFilters = arrayOf(IntentFilter(NfcAdapter.ACTION_TAG_DISCOVERED))
        nfcAdapter?.enableForegroundDispatch(this, pendingIntent, tagFilters, null)
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableForegroundDispatch(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)

        if (intent.action == NfcAdapter.ACTION_TAG_DISCOVERED ||
            intent.action == NfcAdapter.ACTION_NDEF_DISCOVERED ||
            intent.action == NfcAdapter.ACTION_TECH_DISCOVERED) {

            val tagId = intent.getByteArrayExtra(NfcAdapter.EXTRA_ID)

            if (tagId != null) {
                val codigoFormateado = uidComoR20C(tagId)

                if (estadoSesion.visibility == View.VISIBLE) {
                    verificarProfesor(codigoFormateado)
                } else {
                    verificarSalidaRecreo(codigoFormateado)
                }

                Toast.makeText(this, "UID (R20C): $codigoFormateado", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "No se pudo leer el ID del Tag", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private val client = OkHttpClient()

    private fun verificarSalidaRecreo(nfcId: String) {

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val url = "http://10.102.7.221:5000/Salida_Recreo"

                val jsonObject = JSONObject()
                jsonObject.put("nfc", nfcId)

                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = jsonObject.toString().toRequestBody(mediaType)

                val request = Request.Builder()
                    .url(url)
                    .post(body)
                    .build()

                val response = client.newCall(request).execute()

                if (response.isSuccessful) {
                    val respuestaString = response.body?.string() ?: ""

                    try {
                        val jsonRespuesta = JSONObject(respuestaString)

                        val dataArray = jsonRespuesta.getJSONArray("data")

                        if (dataArray.length() > 0) {
                            val primerUsuario = dataArray.getJSONObject(0)

                            val nombre = primerUsuario.getString("nombre")
                            val recreo = primerUsuario.getBoolean("recreo")
                            val apellidos = primerUsuario.getString("apellidos")
                            val curso = primerUsuario.getString("curso")

                            withContext(Dispatchers.Main) {
                                nombre_xml.text = "Nombre:\n$nombre" + " $apellidos"
                                nombre_xml.setPadding(0,0,0,500)
                                curso_xml.text = "Curso: $curso"
                                estado.text = "${if(recreo) "Autorizado" else "No autorizado"}"
                                estado.setPadding(0,500,0,0)

                                if (estado.text == "Autorizado") {
                                    estado.setTextColor(Color.GREEN)
                                } else {
                                    estado.setTextColor(Color.RED)
                                }
                                nombre_xml.visibility = View.VISIBLE
                                curso_xml.visibility = View.VISIBLE
                            }
                        } else {
                            withContext(Dispatchers.Main) {
                                estado.text = "El usuario no existe"
                            }
                        }

                    } catch (e: Exception) {
                        withContext(Dispatchers.Main) {
                            estado.text = "No se ha encontrado al usuario en la base de datos"
                        }
                    }
                } else {
                    withContext(Dispatchers.Main) {
                        estado.text = "Error del servidor: Código ${response.code}"
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    estado.text = "Error de conexión: Verifica la red y que el servidor esté encendido."
                    e.printStackTrace()
                }
            }
        }
    }

    private fun verificarProfesor(nfcId: String) {

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val url = "http://10.102.7.221:5000/GetProfesor"

                val jsonObject = JSONObject()
                jsonObject.put("nfc", nfcId)

                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = jsonObject.toString().toRequestBody(mediaType)

                val request = Request.Builder()
                    .url(url)
                    .post(body)
                    .build()

                val response = client.newCall(request).execute()

                if (response.isSuccessful) {
                    val respuestaString = response.body?.string() ?: ""

                    try {
                        val jsonRespuesta = JSONObject(respuestaString)
                        val dataArray = jsonRespuesta.getJSONArray("data")


                        if (dataArray.length() > 0) {
                            val profesor = dataArray.getJSONObject(0)

                            val nombre = profesor.getString("nombre")
                            val apellidos = profesor.getString("apellidos")

                            withContext(Dispatchers.Main) {
                                estadoSesion.text = "Sesión iniciada"
                                estadoSesion.setTextColor(Color.GREEN)

                                profesor_xml.text = "Profesor:\n$nombre $apellidos"
                                estadoSesion.setPadding(0,250,0,0)
                                profesor_xml.visibility = View.VISIBLE

                                curso_xml.visibility = View.GONE
                                siguiente_xml.visibility = View.VISIBLE
                            }

                        } else {
                            withContext(Dispatchers.Main) {
                                estadoSesion.text = "Profesor no encontrado"
                                estadoSesion.setTextColor(Color.RED)
                            }
                        }

                    } catch (e: Exception) {
                        withContext(Dispatchers.Main) {
                            estadoSesion.text = "Error procesando respuesta" + e
                        }
                    }

                } else {
                    withContext(Dispatchers.Main) {
                        estadoSesion.text = "Error servidor: ${response.code}"
                    }
                }

            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    estadoSesion.text = "Error de conexión"
                }
            }
        }
    }

    fun uidComoR20C(tagId: ByteArray): String {

        val first4 = tagId.copyOfRange(0, 4)

        val reversed = first4.reversedArray()

        var result: Long = 0
        for (byte in reversed) {
            result = (result shl 8) or (byte.toInt() and 0xFF).toLong()
        }

        return String.format("%010d", result)
    }
}