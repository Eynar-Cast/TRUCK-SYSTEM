# estructura.ps1 — genera la estructura de carpetas de GestorCompras

# ---- Rutas de páginas (App Router) ----
$carpetas = @(
  "app\(auth)\login",
  "app\(app)\nueva-compra",
  "app\(app)\mis-compras",
  "app\(app)\devoluciones",
  "app\(app)\gasto-chofer",
  "app\(app)\historial",
  "app\(app)\choferes",
  "app\(app)\gastos-choferes",
  "app\(app)\usuarios",
  "app\api\auth\login",
  "app\api\auth\logout",
  "app\api\auth\session",
  "app\api\compras\[id]",
  "app\api\devoluciones",
  "app\api\choferes\[id]",
  "app\api\gastos-choferes\[id]",
  "app\api\usuarios\[id]",
  "components\ui",
  "components\nav",
  "components\forms",
  "components\tables",
  "components\modals",
  "lib",
  "db"
)

foreach ($c in $carpetas) {
    New-Item -ItemType Directory -Force -Path $c | Out-Null
}

$archivos = @(
  "app\(auth)\login\page.jsx",
  "app\(app)\layout.jsx",
  "app\(app)\nueva-compra\page.jsx",
  "app\(app)\mis-compras\page.jsx",
  "app\(app)\devoluciones\page.jsx",
  "app\(app)\gasto-chofer\page.jsx",
  "app\(app)\historial\page.jsx",
  "app\(app)\choferes\page.jsx",
  "app\(app)\gastos-choferes\page.jsx",
  "app\(app)\usuarios\page.jsx",
  "app\api\auth\login\route.js",
  "app\api\auth\logout\route.js",
  "app\api\auth\session\route.js",
  "app\api\compras\route.js",
  "app\api\compras\[id]\route.js",
  "app\api\devoluciones\route.js",
  "app\api\choferes\route.js",
  "app\api\choferes\[id]\route.js",
  "app\api\gastos-choferes\route.js",
  "app\api\gastos-choferes\[id]\route.js",
  "app\api\usuarios\route.js",
  "app\api\usuarios\[id]\route.js",
  "components\nav\Sidebar.jsx",
  "components\nav\MobileHeader.jsx",
  "components\ui\Toast.jsx",
  "components\ui\Badge.jsx",
  "components\ui\StatCard.jsx",
  "components\forms\UploadZone.jsx",
  "components\tables\TablaCompras.jsx",
  "components\modals\ModalDetalle.jsx",
  "lib\db.js",
  "lib\auth.js",
  "lib\session.js",
  "lib\utils.js",
  "db\schema.sql",
  ".env.local",
  ".env.example"
)

foreach ($a in $archivos) {
    New-Item -ItemType File -Force -Path $a | Out-Null
}

Write-Host "Estructura de GestorCompras generada correctamente" -ForegroundColor Green