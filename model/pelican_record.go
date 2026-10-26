package model

// PelicanRecordSvgMaxBytes keeps SVG markup within a MySQL TEXT column.
const PelicanRecordSvgMaxBytes = 60000

// PelicanRecord is one "pelican riding a bicycle" SVG test shared on the
// model market. Every viewer can see every record.
type PelicanRecord struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int    `json:"-" gorm:"not null;index"`
	ModelName    string `json:"model" gorm:"type:varchar(255);not null;index:idx_pelican_model_created,priority:1"`
	Vendor       string `json:"vendor" gorm:"type:varchar(255)"`
	Prompt       string `json:"prompt" gorm:"type:text"`
	Group        string `json:"group" gorm:"type:varchar(64)"`
	Svg          string `json:"svg" gorm:"type:text"`
	FirstTokenMs *int64 `json:"first_token_ms"`
	TotalMs      int64  `json:"total_ms" gorm:"bigint"`
	OutputTokens *int   `json:"output_tokens"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;index:idx_pelican_model_created,priority:2"`
}

func (PelicanRecord) TableName() string {
	return "pelican_records"
}

// ListPelicanRecords returns the newest records, optionally for one model.
func ListPelicanRecords(modelName string, limit int) ([]PelicanRecord, error) {
	var records []PelicanRecord
	query := DB.Order("created_at DESC, id DESC").Limit(limit)
	if modelName != "" {
		query = query.Where("model_name = ?", modelName)
	}
	err := query.Find(&records).Error
	return records, err
}

func CreatePelicanRecord(record *PelicanRecord) error {
	return DB.Create(record).Error
}

func GetPelicanRecordById(id int) (*PelicanRecord, error) {
	var record PelicanRecord
	err := DB.First(&record, "id = ?", id).Error
	return &record, err
}

func DeletePelicanRecord(id int) error {
	return DB.Delete(&PelicanRecord{}, "id = ?", id).Error
}

// GetUsernamesByIds maps user ids to usernames for display.
func GetUsernamesByIds(ids []int) (map[int]string, error) {
	var users []struct {
		Id       int
		Username string
	}
	names := make(map[int]string, len(ids))
	if len(ids) == 0 {
		return names, nil
	}
	err := DB.Model(&User{}).Select("id, username").Where("id IN ?", ids).Find(&users).Error
	for _, user := range users {
		names[user.Id] = user.Username
	}
	return names, err
}
