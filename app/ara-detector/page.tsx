import ARADetectorPanel from '../components/ARADetectorPanel';

export const metadata = {
  title: 'ARA Detector | Adimology',
  description: 'Deteksi otomatis saham berpotensi ARA berdasarkan sinyal bandar, orderbook, volume, dan momentum.',
};

export default function ARADetectorPage() {
  return <ARADetectorPanel />;
}
