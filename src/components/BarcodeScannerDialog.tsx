import { useEffect, useRef, useState } from 'react'
import type { Html5Qrcode } from 'html5-qrcode'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { Message } from 'primereact/message'

const SCANNER_ELEMENT_ID = 'barcode-scanner-preview'

interface BarcodeScannerDialogProps {
  onClose: () => void
  onScan: (barcode: string) => void
}

export function BarcodeScannerDialog({ onClose, onScan }: BarcodeScannerDialogProps) {
  const hasReadCodeRef = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    let scanner: Html5Qrcode | null = null

    const startScanner = async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')

        if (!isActive) {
          return
        }

        const scannerInstance = new Html5Qrcode(SCANNER_ELEMENT_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        })
        scanner = scannerInstance

        await scannerInstance.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 140 },
            aspectRatio: 1.8,
            disableFlip: true,
          },
          (decodedText) => {
            if (!isActive || hasReadCodeRef.current) {
              return
            }

            hasReadCodeRef.current = true
            void scannerInstance.stop()
              .catch(() => undefined)
              .finally(() => {
                if (isActive) {
                  onScan(decodedText)
                }
              })
          },
          () => undefined,
        )

        if (!isActive && scannerInstance.isScanning) {
          void scannerInstance.stop().catch(() => undefined)
        }
      } catch {
        if (isActive) {
          setError('Não foi possível acessar a câmera. Verifique a permissão concedida ao navegador.')
        }
      }
    }

    void startScanner()

    return () => {
      isActive = false
      if (scanner?.isScanning) {
        void scanner.stop().catch(() => undefined)
      }
    }
  }, [onScan])

  return (
    <Dialog
      visible
      modal
      header="Ler código de barras"
      className="barcode-scanner-dialog"
      onHide={onClose}
      dismissableMask
    >
      <div className="barcode-scanner-content">
        <div id={SCANNER_ELEMENT_ID} className="barcode-scanner-preview" />
        {error
          ? <Message severity="error" text={error} />
          : <small>Aponte a câmera para o código de barras do produto.</small>}
        <Button type="button" label="Fechar" outlined onClick={onClose} />
      </div>
    </Dialog>
  )
}
