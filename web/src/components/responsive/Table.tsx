import { ReactNode, useIsMobile } from '../../hooks/useMediaQuery'

interface Column<T> {
  key: keyof T | string
  header: string
  width?: string
  render?: (row: T, index: number) => ReactNode
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: keyof T
  emptyMessage?: string
  onRowClick?: (row: T) => void
}

/**
 * Responsive Table component
 * - Desktop: Standard HTML table
 * - Mobile: Card-based list with inline details
 */
export default function Table<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  emptyMessage = 'No data',
  onRowClick
}: TableProps<T>) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 24,
            color: 'var(--win-gray-dark)',
            fontSize: 14
          }}>
            {emptyMessage}
          </div>
        ) : (
          data.map((row, index) => (
            <div
              key={String(row[keyField])}
              onClick={() => onRowClick?.(row)}
              style={{
                background: 'var(--win-white)',
                border: '2px solid',
                borderColor: 'var(--win-gray-dark) var(--win-white) var(--win-white) var(--win-gray-dark)',
                padding: 12,
                cursor: onRowClick ? 'pointer' : 'default'
              }}
            >
              {columns.map((col, colIndex) => (
                <div key={String(col.key)} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: colIndex < columns.length - 1 ? 8 : 0,
                  fontSize: 14
                }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--win-gray-dark)' }}>
                    {col.header}:
                  </span>
                  <span style={{ textAlign: 'right', maxWidth: '60%' }}>
                    {col.render ? col.render(row, index) : row[col.key]}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    )
  }

  return (
    <div style={{
      border: '2px solid var(--win-gray-dark)',
      overflow: 'hidden'
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12
      }}>
        <thead>
          <tr style={{ background: 'var(--win-gray)' }}>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                style={{
                  padding: '6px 8px',
                  textAlign: 'left',
                  borderBottom: '2px solid var(--win-gray-dark)',
                  borderRight: '1px solid var(--win-gray-dark)',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  width: col.width
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  textAlign: 'center',
                  padding: 24,
                  color: 'var(--win-gray-dark)'
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={String(row[keyField])}
                onClick={() => onRowClick?.(row)}
                style={{
                  background: index % 2 === 0 ? 'var(--win-white)' : 'var(--win-gray)',
                  cursor: onRowClick ? 'pointer' : 'default'
                }}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    style={{
                      padding: '4px 8px',
                      borderBottom: '1px solid var(--win-gray)',
                      borderRight: '1px solid var(--win-gray)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 200
                    }}
                  >
                    {col.render ? col.render(row, index) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
