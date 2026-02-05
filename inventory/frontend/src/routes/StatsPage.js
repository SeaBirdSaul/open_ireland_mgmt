/**
 * StatsPage component displays an overview of inventory statistics.
 * It provides metrics such as total device count, devices by status,
 *  devices by type, and devices by site.
 */
import React from 'react';
import { PageHeader, Card } from '@tcdona/ui';
import { useDeviceCount, useDevicesByStatus } from '../hooks/useDevices';

/**
 * Currently using legacy inputs (Available, Maintenance, Unavailable) to useDeviceByStatus
 * Eventually update to use new inputs (active, in_maintenance, retired, spare, planned)
 */
export default function StatsPage() {
  const { data: devicesCount, isLoading: isCountLoading, error: countError } = useDeviceCount();
  const { data: availableCount, isAvailableLoading, availableError } = useDevicesByStatus('Available');
  const { data: maintenanceCount, isMaintenanceLoading, maintenanceError } = useDevicesByStatus('Maintenance');
  const { data: retiredCount, isRetiredLoading, retiredError } = useDevicesByStatus('Unavailable');
  return (
    <div className="p-6">
      <PageHeader
        title="Inventory Overview"
        subtitle="Statistics and metrics for inventory management"
      />
      <div className="mt-6">
        <Card>
          <div className="p-4">
            <p className="text-gray-600 dark:text-gray-400">
              Stats dashboard goes here. This will show:
              <ul className="list-disc list-inside mt-2">
                <li>
                  Total device count:{' '}
                  {countError
                    ? 'Error'
                    : isCountLoading
                      ? 'Loading...'
                      : devicesCount}
                </li>
                <li>Devices by status:
                    <table style={{ width: '100%' }}>
                      <tr>
                        <th style={{ color: 'green' }}>AVAILABLE</th>
                        <th style={{ color: 'red' }}>MAINTENANCE</th>
                        <th>RETIRED</th>
                      </tr>
                      <tr>
                        <th style={{ color: 'green' }}>{availableError
                        ? 'Error'
                        : isAvailableLoading
                          ? ' Loading...'
                          : availableCount}
                        </th>
                        <th style={{ color: 'red' }}>{maintenanceError
                        ? 'Error'
                        : isMaintenanceLoading
                          ? ' Loading...'
                          : maintenanceCount}
                        </th>
                        <th>
                          {retiredError
                        ? 'Error'
                        : isRetiredLoading
                          ? ' Loading...'
                          : retiredCount}
                        </th>
                      </tr>
                    </table>
                  </li>
                <li>Devices by type</li>
                <li>Devices by site</li>
              </ul>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
